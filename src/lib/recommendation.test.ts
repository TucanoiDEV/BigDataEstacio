import { describe, expect, it } from "vitest";
import { isSparseProfile, scoreJob, yearsOfExperience, type RecJob, type RecProfile } from "@/lib/recommendation";

const profile: RecProfile = {
  skills: ["react", "typescript", "git"],
  desiredTitle: "Desenvolvedor Front-end",
  desiredSectors: ["Tecnologia da informação"],
  desiredWorkModels: ["REMOTE"],
  desiredContractTypes: ["CLT"],
  desiredSeniority: "JUNIOR",
  desiredSalaryMin: 3000,
  city: "Recife",
  state: "PE",
  openToRelocation: false,
  yearsExperience: 1,
};

const job: RecJob = {
  title: "Desenvolvedor(a) Front-end Júnior",
  sector: "Tecnologia da informação",
  workModel: "REMOTE",
  contractType: "CLT",
  seniority: "JUNIOR",
  city: null,
  state: null,
  salaryMin: 3500,
  salaryMax: 5000,
  skills: [
    { slug: "react", name: "React", required: true },
    { slug: "typescript", name: "TypeScript", required: true },
    { slug: "docker", name: "Docker", required: true },
  ],
};

describe("recomendação explicável", () => {
  it("pontua alto e explica os motivos", () => {
    const r = scoreJob(profile, job);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.reasons.join(" ")).toMatch(/2 de 3 competências exigidas/);
    expect(r.gaps.join(" ")).toMatch(/Docker/);
  });

  it("perfil sem competências não recebe '0 de N' como motivo positivo", () => {
    const empty: RecProfile = { ...profile, skills: [], desiredTitle: null, desiredSectors: [] };
    const r = scoreJob(empty, job);
    expect(r.reasons.join(" ")).not.toMatch(/competências exigidas/);
    expect(r.gaps.join(" ")).toMatch(/React/);
    expect(isSparseProfile(empty)).toBe(true);
    expect(isSparseProfile(profile)).toBe(false);
  });

  it("modalidade e contratação fora da preferência reduzem a pontuação", () => {
    const onsite = scoreJob(profile, { ...job, workModel: "ON_SITE", city: "Curitiba", state: "PR", contractType: "PJ" });
    expect(onsite.score).toBeLessThan(scoreJob(profile, job).score - 20);
    expect(onsite.gaps.length).toBeGreaterThanOrEqual(2);
  });

  it("é determinística e limitada a 0–100", () => {
    const a = scoreJob(profile, job);
    const b = scoreJob(profile, job);
    expect(a).toEqual(b);
    const empty = scoreJob({ ...profile, skills: [], desiredTitle: null, desiredSectors: [], desiredWorkModels: [], desiredContractTypes: [], desiredSalaryMin: null, desiredSeniority: null, state: null, city: null }, job);
    expect(empty.score).toBeGreaterThanOrEqual(0);
    expect(empty.score).toBeLessThanOrEqual(100);
  });

  it("usa apenas dados profissionais declarados (sem atributos sensíveis no tipo de entrada)", () => {
    const keys = Object.keys(profile).sort();
    expect(keys).toEqual(["city", "desiredContractTypes", "desiredSalaryMin", "desiredSectors", "desiredSeniority", "desiredTitle", "desiredWorkModels", "openToRelocation", "skills", "state", "yearsExperience"].sort());
  });

  it("anos de experiência não contam períodos sobrepostos duas vezes", () => {
    const now = new Date("2026-01-01");
    const years = yearsOfExperience(
      [
        { startDate: new Date("2020-01-01"), endDate: new Date("2022-01-01"), isCurrent: false },
        { startDate: new Date("2021-01-01"), endDate: new Date("2023-01-01"), isCurrent: false },
        { startDate: new Date("2025-01-01"), endDate: null, isCurrent: true },
      ],
      now,
    );
    expect(years).toBeCloseTo(4, 0);
  });
});
