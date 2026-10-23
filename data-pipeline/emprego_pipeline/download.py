"""Coleta autorizada de arquivos oficiais, com verificação de origem e checksum."""

from __future__ import annotations

import ftplib
import gzip
import hashlib
import shutil
import subprocess
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

from .config import ALLOWED_HOSTS


@dataclass(frozen=True)
class FetchedFile:
    name: str
    url: str
    path: Path
    sha256: str
    bytes: int

    def as_record(self) -> dict:
        return {"name": self.name, "url": self.url, "sha256": self.sha256, "bytes": self.bytes}


def assert_allowed(url: str) -> None:
    host = urlparse(url).hostname or ""
    if host not in ALLOWED_HOSTS:
        raise ValueError(f"Origem não autorizada: {host}")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _ftp_download(url: str, dest: Path, timeout: int) -> None:
    """FTP anônimo. Prefere curl (timeouts de baixa velocidade e retomada); ftplib como alternativa.

    O handler FTP do urllib falha com o modo EPSV do servidor do MTE, e o ftplib
    pode travar aguardando a resposta final em transferências longas.
    """
    curl = shutil.which("curl")
    if curl:
        cmd = [curl, "--silent", "--show-error", "--fail", "--retry", "3", "--connect-timeout", "30",
               "--speed-limit", "1024", "--speed-time", "60", "--continue-at", "-", "--output", str(dest), url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout * 3)
        if result.returncode != 0:
            raise IOError(f"curl falhou ({result.returncode}): {result.stderr.strip()[:300]}")
        return
    parsed = urlparse(url)
    remote = unquote(parsed.path)
    with ftplib.FTP(parsed.hostname, timeout=timeout) as ftp, dest.open("wb") as out:
        ftp.login()
        ftp.set_pasv(True)
        expected = ftp.size(remote)
        ftp.retrbinary(f"RETR {remote}", out.write, blocksize=1024 * 1024)
    if expected is not None and dest.stat().st_size != expected:
        raise IOError(f"Download incompleto: {dest.stat().st_size} de {expected} bytes")


def _gunzip_if_needed(path: Path, url: str) -> None:
    """Algumas APIs do IBGE respondem com gzip mesmo sem Accept-Encoding."""
    if url.lower().endswith((".gz", ".7z", ".zip")):
        return
    with path.open("rb") as f:
        magic = f.read(2)
    if magic == b"\x1f\x8b":
        data = gzip.decompress(path.read_bytes())
        path.write_bytes(data)


def fetch(url: str, dest: Path, *, retries: int = 3, timeout: int = 600, force: bool = False) -> FetchedFile:
    """Baixa `url` para `dest` (reutiliza se já existir). Apenas hosts oficiais."""
    assert_allowed(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if force or not dest.exists() or dest.stat().st_size == 0:
        tmp = dest.with_suffix(dest.suffix + ".part")
        last_err: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                if url.startswith("ftp://"):
                    _ftp_download(url, tmp, timeout)
                else:
                    req = urllib.request.Request(url, headers={"User-Agent": "EmpregoAgora-Pipeline/0.1 (+dados abertos)"})
                    with urllib.request.urlopen(req, timeout=timeout) as resp, tmp.open("wb") as out:  # noqa: S310 (host validado)
                        shutil.copyfileobj(resp, out, length=1024 * 1024)
                _gunzip_if_needed(tmp, url)
                tmp.replace(dest)
                break
            except Exception as err:  # pragma: no cover - rede
                last_err = err
                time.sleep(2 * attempt)
        else:  # pragma: no cover - rede
            raise RuntimeError(f"Falha ao baixar {url}: {last_err}")
    return FetchedFile(name=dest.name, url=url, path=dest, sha256=sha256_file(dest), bytes=dest.stat().st_size)
