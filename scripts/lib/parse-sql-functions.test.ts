import { describe, expect, it } from "vitest"

import {
  parseDropFunctionStatement,
  parseFunctionStatement,
  splitStatements,
} from "./parse-sql-functions.mjs"

/** Parses a definition that the test asserts is well-formed. */
function parse(sql: string) {
  const parsed = parseFunctionStatement(sql)
  if (!parsed) throw new Error(`expected a function definition:\n${sql}`)
  return parsed
}

/** Parses a drop that the test asserts is well-formed. */
function parseDrop(sql: string) {
  const parsed = parseDropFunctionStatement(sql)
  if (!parsed) throw new Error(`expected a drop statement:\n${sql}`)
  return parsed
}

describe("splitStatements", () => {
  it("splits on top-level semicolons", () => {
    const statements = splitStatements("select 1; select 2;")
    expect(statements.map((s: { text: string }) => s.text.trim())).toEqual([
      "select 1;",
      "select 2;",
    ])
  })

  it("does not split on a semicolon inside a dollar-quoted body", () => {
    const sql = `
create or replace function public.f() returns void
language plpgsql as $$
begin
  perform 1;
  perform 2;
end;
$$;
select 'after';
`
    const statements = splitStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0].text).toContain("perform 2;")
  })

  it("respects a tagged dollar quote containing a bare $$", () => {
    const sql = `
create or replace function public.f() returns text
language sql as $body$
  select '$$ not a terminator; still inside';
$body$;
select 1;
`
    const statements = splitStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0].text).toContain("not a terminator")
  })

  it("ignores semicolons in line and block comments", () => {
    const sql = `
-- a comment; with a semicolon
/* block; comment /* nested; */ still */
select 1;
`
    expect(splitStatements(sql)).toHaveLength(1)
  })

  it("ignores semicolons inside string literals, including escaped quotes", () => {
    expect(splitStatements("select 'a;b', 'it''s; fine';")).toHaveLength(1)
  })

  it("does not mistake a positional parameter for a dollar quote", () => {
    // `$1` is not a valid dollar-quote tag; treating it as one would swallow
    // the rest of the file.
    const statements = splitStatements("select $1; select $2;")
    expect(statements).toHaveLength(2)
  })
})

describe("parseFunctionStatement", () => {
  it("extracts name and argument types, ignoring parameter names", () => {
    const parsed = parse(
      "create or replace function public.f(p_id uuid, p_count integer) returns void language sql as $$ $$;"
    )
    expect(parsed.name).toBe("public.f")
    expect(parsed.argTypes).toEqual(["uuid", "integer"])
    expect(parsed.signature).toBe("public.f(uuid, integer)")
  })

  it("strips defaults from the identity", () => {
    const parsed = parse(
      "create or replace function public.f(p_a uuid, p_b jsonb default null) returns void language sql as $$ $$;"
    )
    expect(parsed.signature).toBe("public.f(uuid, jsonb)")
  })

  it("keeps nested type parens out of the argument split", () => {
    const parsed = parse(
      "create or replace function public.f(p_a numeric(10,2), p_b text) returns void language sql as $$ $$;"
    )
    expect(parsed.argTypes).toEqual(["numeric(10,2)", "text"])
  })

  it("handles array and composite types", () => {
    const parsed = parse(
      "create or replace function public.f(p_a text[], p_b public.credit_reservations) returns void language sql as $$ $$;"
    )
    expect(parsed.argTypes).toEqual(["text[]", "public.credit_reservations"])
  })

  it("drops an argmode prefix", () => {
    const parsed = parse(
      "create or replace function public.f(in p_a uuid, variadic p_b text[]) returns void language sql as $$ $$;"
    )
    expect(parsed.argTypes).toEqual(["uuid", "text[]"])
  })

  it("reports a zero-argument function", () => {
    const parsed = parse(
      "create or replace function public.f() returns void language sql as $$ $$;"
    )
    expect(parsed.signature).toBe("public.f()")
  })

  it("excludes leading comments from the definition", () => {
    const statement = `-- explains the migration, not the function
create or replace function public.f() returns void language sql as $$ $$;`
    const parsed = parse(statement)
    expect(parsed.definition.startsWith("create or replace function")).toBe(true)
    expect(parsed.definition).not.toContain("explains the migration")
  })

  it("returns null for a non-function statement", () => {
    expect(parseFunctionStatement("create table t (id uuid);")).toBeNull()
  })
})

describe("parseDropFunctionStatement", () => {
  it("parses a drop with an argument list", () => {
    const parsed = parseDrop("drop function if exists public.f(uuid, integer);")
    expect(parsed.signature).toBe("public.f(uuid, integer)")
  })

  it("returns null for a create statement", () => {
    expect(
      parseDropFunctionStatement(
        "create or replace function public.f() returns void language sql as $$ $$;"
      )
    ).toBeNull()
  })
})
