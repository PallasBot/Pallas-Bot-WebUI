import { describe, expect, expectTypeOf, it } from "vitest";
import type { components, paths } from "./generated/pallasConsoleOpenapi";

type PersonaObserve = components["schemas"]["_PersonaObserveData"];
type SemanticStatus = components["schemas"]["_SemanticStyleStatusData"];
type SemanticManage = components["schemas"]["_SemanticStyleManageBody"];
type SemanticGetQuery = NonNullable<
  paths["/pallas/api/llm/repeater-semantic-style"]["get"]["parameters"]["query"]
>;
type PersonaObserveResponse =
  paths["/pallas/api/common-config/llm/persona-observe"]["get"]["responses"][200]["content"]["application/json"];
type SemanticGetResponse =
  paths["/pallas/api/llm/repeater-semantic-style"]["get"]["responses"][200]["content"]["application/json"];
type SemanticManageRequest =
  paths["/pallas/api/llm/repeater-semantic-style/manage"]["post"]["requestBody"]["content"]["application/json"];
type SemanticManageResponse =
  paths["/pallas/api/llm/repeater-semantic-style/manage"]["post"]["responses"][200]["content"]["application/json"];

describe("persona generated contracts", () => {
  it("覆盖 persona observe 的 account profile", () => {
    expectTypeOf<PersonaObserveResponse>().toEqualTypeOf<
      components["schemas"]["_ApiOkResponse__PersonaObserveData_"]
    >();
    const data = {
      group_id: 42,
      bots: [
        {
          account: 100,
          group_style_enabled: true,
          account_profile: {
            energy: 0.5,
            warmth: 0,
            mischief: 0,
            restraint: -0.25,
            source: "manual",
          },
          base: {},
        },
      ],
    } satisfies PersonaObserve;

    expect(data.bots[0].account_profile.source).toBe("manual");
  });

  it("覆盖 semantic scene、nullable patch 与 typed status", () => {
    expectTypeOf<SemanticGetResponse>().toEqualTypeOf<
      components["schemas"]["_ApiOkResponse__SemanticStyleStatusData_"]
    >();
    expectTypeOf<SemanticManageRequest>().toEqualTypeOf<SemanticManage>();
    expectTypeOf<SemanticManageResponse>().toEqualTypeOf<
      components["schemas"]["_ApiOkResponse_Union__SemanticStyleStatusData___SemanticStyleQualityData__"]
    >();
    const query = { bot_id: 100, group_id: 42, scene: "group_chat" } satisfies SemanticGetQuery;
    const body = {
      action: "overrides",
      bot_id: 100,
      group_id: 42,
      scene: "group_chat",
      overrides: { direct: null },
    } satisfies SemanticManage;
    const status = {
      enabled: true,
      collection_enabled: true,
      injection_enabled: true,
      overrides: { aggressive: false, nonsense: false, direct: true, image: false },
      example_count: 2,
      profile_count: 1,
    } satisfies SemanticStatus;

    expect(query.scene).toBe("group_chat");
    expect(body.overrides.direct).toBeNull();
    expect(status.profile_count).toBe(1);
  });
});
