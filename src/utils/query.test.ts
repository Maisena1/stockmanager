import { describe, expect, it } from "vitest";
import { firstString, parseBooleanQuery, parseDateQuery } from "./query";

describe("firstString", () => {
  it("acepta un string", () => {
    expect(firstString("abc")).toBe("abc");
  });

  it("toma el primer string de un array (Express 5)", () => {
    expect(firstString(["abc", "def"])).toBe("abc");
  });

  it("devuelve undefined para arrays sin strings", () => {
    expect(firstString([1, null])).toBeUndefined();
  });

  it("devuelve undefined si el parámetro no vino", () => {
    expect(firstString(undefined)).toBeUndefined();
  });
});

describe("parseBooleanQuery", () => {
  it("parsea true y false", () => {
    expect(parseBooleanQuery("true")).toBe(true);
    expect(parseBooleanQuery("false")).toBe(false);
  });

  it("devuelve undefined si no vino o está vacío", () => {
    expect(parseBooleanQuery(undefined)).toBeUndefined();
    expect(parseBooleanQuery("")).toBeUndefined();
  });

  it("devuelve null si el valor es inválido", () => {
    expect(parseBooleanQuery("si")).toBeNull();
    expect(parseBooleanQuery("1")).toBeNull();
  });
});

describe("parseDateQuery", () => {
  it("interpreta AAAA-MM-DD en horario local", () => {
    const date = parseDateQuery("2026-10-05", false);
    expect(date).toBeInstanceOf(Date);
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(9);
    expect(date!.getDate()).toBe(5);
    expect(date!.getHours()).toBe(0);
    expect(date!.getMinutes()).toBe(0);
  });

  it("usa el final del día para el límite superior", () => {
    const date = parseDateQuery("2026-10-05", true);
    expect(date!.getHours()).toBe(23);
    expect(date!.getMinutes()).toBe(59);
    expect(date!.getSeconds()).toBe(59);
    expect(date!.getMilliseconds()).toBe(999);
  });

  it("rechaza fechas inexistentes", () => {
    expect(parseDateQuery("2026-02-31", false)).toBeNull();
    expect(parseDateQuery("2026-13-01", false)).toBeNull();
  });

  it("rechaza formatos que no son AAAA-MM-DD", () => {
    expect(parseDateQuery("2026-10-05T00:00:00Z", false)).toBeNull();
  });

  it("devuelve undefined si no vino", () => {
    expect(parseDateQuery(undefined, false)).toBeUndefined();
  });
});
