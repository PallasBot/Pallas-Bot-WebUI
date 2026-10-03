// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommonConfigForm from "@/components/CommonConfigForm";
import { DraftProtectionProvider } from "@/components/DraftProtection";
import type { PluginConfigData as PluginFormConfigData } from "./console";
import type {
  InstancesData,
  PluginGovernanceData,
  OpenapiPluginGovernanceUpdateData,
  PluginRow,
} from "./pallasTypes";
import type { ConsoleOpenapiPaths, OpenapiOkData } from "./consoleOpenapiClient";

const transport = vi.hoisted(() => ({
  openapiGet: vi.fn(),
  openapiPut: vi.fn(),
  httpGet: vi.fn(),
  httpPut: vi.fn(),
}));

vi.mock("./consoleOpenapiClient", () => ({
  consoleOpenapiDelete: vi.fn(),
  consoleOpenapiGet: transport.openapiGet,
  consoleOpenapiPatch: vi.fn(),
  consoleOpenapiPost: vi.fn(),
  consoleOpenapiPut: transport.openapiPut,
}));

vi.mock("./http", () => ({
  DB_BACKUP_TIMEOUT_MS: 10,
  DB_HEAVY_READ_TIMEOUT_MS: 20,
  axiosErrorDetail: (error: unknown) => error instanceof Error ? error.message : String(error),
  http: {
    delete: vi.fn(),
    get: transport.httpGet,
    patch: vi.fn(),
    post: vi.fn(),
    put: transport.httpPut,
  },
}));

vi.mock("@/components/config/PluginConfigFieldShell", () => ({
  default: ({
    field,
    modelValue,
    onValueChange,
  }: {
    field: { name: string };
    modelValue: string;
    onValueChange: (value: string) => void;
  }) => (
    <label>
      {field.name}
      <input
        aria-label={field.name}
        value={modelValue}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </label>
  ),
}));

vi.mock("@/components/config/PluginConfigFormSection", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function openapiConfig(): PluginFormConfigData {
  return {
    plugin: "log_level",
    module: "pallas.core.foundation.log_level_config",
    fields: [{
      name: "log_level",
      kind: "string",
      required: false,
      description: "",
      env_key: "LOG_LEVEL",
      default: "INFO",
      current: "INFO",
      ui_group: null,
      ui_order: { future: 1 },
      ui_hidden: ["future"],
      ui_widget: { kind: "future" },
      ui_gateway: { providers: ["future"] },
      secret: true,
    }],
    field_groups: [{ id: "general", title: "通用", field_names: ["log_level"], future: null }],
    hot_reload: null,
    future_metadata: { revision: 2 },
  };
}

function instancesPayload(): InstancesData {
  const protocol = {
    plugin: "pb_protocol",
    webui_enabled: true,
    webui_path: "/protocol",
    console_auth_configured: true,
    accounts: [{ id: null, qq: "42", future_account_value: { active: true } }],
  };
  return {
    nonebot_bots: [{ connection_key: "onebot:42", self_id: "42", adapter: "OneBot V11", online: null }],
    db_bot_configs: [],
    pallas_protocol: protocol,
    napcat: protocol,
    protocol_extension: {
      installed: true,
      package: "pallas-plugin-protocol",
      uv_extra: null,
      install_cli: null,
      activation_policy: "future-policy",
      repository_url: null,
      future_status: [1, null],
    },
    bot_profiles: { "42": { user_id: 42, future_profile_value: { online: true } } },
    future_snapshot: "kept",
  };
}

function governancePayload(): PluginGovernanceData {
  return {
    plugin: "fixture",
    title: "Fixture",
    commands: [{ command_id: "fixture.run", label: "运行", future_command_value: true }],
    menu_items: [{ trigger_condition: ["future", "metadata"] }],
    runtime: {
      global_disable: false,
      global_disable_revision: "rev-1",
      help_hidden: false,
      global_disable_protected: false,
      help_ignored: false,
      future_runtime_value: "kept",
    },
    perm_ui_filtered: {
      levels: [{ id: "everyone", label: "所有人" }],
      plugins: [{
        plugin: "fixture",
        title: "Fixture",
        commands: [{
          command_id: "fixture.run",
          label: "运行",
          default_level: "everyone",
          effective_level: "everyone",
          trigger_condition: null,
        }],
        future_permission_value: { revision: 2 },
      }],
    },
    limits_ui_filtered: {
      plugins: [{
        plugin: "fixture",
        title: "Fixture",
        commands: [{
          command_id: "fixture.run",
          label: "运行",
          default_cd_sec: 3,
          effective_cd_sec: 3,
          trigger_condition: null,
        }],
      }],
    },
    blocked_user_ids: [],
    reload_policy: null,
    activation_policy: null,
  };
}

function renderCommonConfig() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    {
      path: "*",
      element: (
        <DraftProtectionProvider>
          <CommonConfigForm sectionId="log_level" />
        </DraftProtectionProvider>
      ),
    },
  ], { initialEntries: ["/edit"] });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("selected generated console contracts", () => {
  it("has concrete generated data compatible with UI models", () => {
    type IsAny<T> = 0 extends 1 & T ? true : false;
    type IsConcrete<T> = IsAny<T> extends true
      ? false
      : [T] extends [never]
        ? false
        : unknown extends T
          ? false
          : true;
    type Assert<T extends true> = T;
    type PluginsData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/plugins"]["get"]>;
    type InstancesContract = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/instances"]["get"]>;
    type GovernanceGet = OpenapiOkData<
      ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/governance"]["get"]
    >;
    type GovernancePut = OpenapiOkData<
      ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/governance"]["put"]
    >;
    type CommonConfigGet = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}"]["get"]>;
    type CommonConfigPut = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}"]["put"]>;
    type CommonConfigRawPut = OpenapiOkData<
      ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}/raw"]["put"]
    >;
    type ContractChecks = [
      Assert<IsConcrete<PluginsData>>,
      Assert<PluginsData extends PluginRow[] ? true : false>,
      Assert<IsConcrete<InstancesContract>>,
      Assert<InstancesContract extends InstancesData ? true : false>,
      Assert<IsConcrete<GovernanceGet>>,
      Assert<GovernanceGet extends PluginGovernanceData ? true : false>,
      Assert<IsConcrete<GovernancePut>>,
      Assert<GovernancePut extends OpenapiPluginGovernanceUpdateData ? true : false>,
      Assert<IsConcrete<CommonConfigGet>>,
      Assert<CommonConfigGet extends PluginFormConfigData ? true : false>,
      Assert<IsConcrete<CommonConfigPut>>,
      Assert<CommonConfigPut extends PluginFormConfigData ? true : false>,
      Assert<IsConcrete<CommonConfigRawPut>>,
      Assert<CommonConfigRawPut extends PluginFormConfigData ? true : false>,
    ];
    const checks: ContractChecks = [
      true, true, true, true, true, true, true, true, true, true, true, true, true, true,
    ];
    expect(checks).toHaveLength(14);
  });

  it("uses the generated client for the common-config API consumed by the form", async () => {
    const config = openapiConfig();
    transport.openapiGet.mockResolvedValue(config);
    transport.httpGet.mockResolvedValue({ data: { ok: true, data: config } });
    const { fetchCommonConfig } = await import("./console");

    await expect(fetchCommonConfig("log_level")).resolves.toEqual(config);
    expect(transport.openapiGet).toHaveBeenCalledWith("/common-config/log_level");
    expect(transport.httpGet).not.toHaveBeenCalled();
  });

  it("keeps open catalog, instance, and governance values while rejecting malformed boundaries", async () => {
    const api = await import("./consoleApi");
    const plugin: PluginRow = {
      name: "fixture",
      nb_plugin_name: "fixture",
      module: "fixture",
      resolved_plugin_id: "fixture",
      resolved_module: "fixture",
      metadata: { name: null, extra: ["future"] },
      load_role: "future-role",
      loaded_in_process: true,
      has_config: false,
      configurable: false,
      help_visible: true,
      help_ignored: false,
      help_hidden: false,
      globally_disabled: false,
      global_disable_protected: false,
      plugin_source: "future-source",
      plugin_source_dir: null,
      plugin_version: null,
      extra_package: null,
      uninstallable: false,
      uninstall_kind: null,
      uninstall_target: null,
      deps_missing: [],
      avatar: null,
      icon: null,
      cover: null,
      catalog_process_role: "future-catalog-role",
      expected_in_catalog_process: true,
      future_catalog_value: { keep: true },
    };
    transport.openapiGet.mockResolvedValueOnce([plugin]);
    await expect(api.fetchPlugins({ bypassCache: true })).resolves.toEqual([plugin]);

    transport.openapiGet.mockResolvedValueOnce([{ ...plugin, name: 42 }]);
    await expect(api.fetchPlugins({ bypassCache: true })).rejects.toThrow("/plugins: 响应异常");

    const instances = instancesPayload();
    transport.openapiGet.mockResolvedValueOnce(instances);
    await expect(api.fetchInstances({ bypassCache: true })).resolves.toEqual(instances);

    const { pallas_protocol: legacyProtocol, ...legacyFields } = instancesPayload();
    const legacyInstances = { ...legacyFields, napcat: legacyProtocol };
    transport.openapiGet.mockResolvedValueOnce(legacyInstances);
    await expect(api.fetchInstances({ bypassCache: true })).resolves.toEqual({
      ...legacyInstances,
      pallas_protocol: legacyProtocol,
    });

    const missingProtocol: Record<string, unknown> = { ...legacyFields };
    delete missingProtocol.napcat;
    transport.openapiGet.mockResolvedValueOnce(missingProtocol);
    await expect(api.fetchInstances({ bypassCache: true })).rejects.toThrow("/instances: 响应异常");

    transport.openapiGet.mockResolvedValueOnce({
      nonebot_bots: [],
      db_bot_configs: [],
      pallas_protocol: null,
      protocol_extension: { installed: false, package: "fixture" },
      bot_profiles: {},
    });
    await expect(api.fetchInstances({ bypassCache: true })).rejects.toThrow("/instances: 响应异常");

    const governance = governancePayload();
    transport.openapiGet.mockResolvedValueOnce(governance);
    await expect(api.fetchPluginGovernance("fixture")).resolves.toEqual(governance);

    transport.openapiGet.mockResolvedValueOnce({ ...governance, runtime: { global_disable: "false" } });
    await expect(api.fetchPluginGovernance("fixture")).rejects.toThrow("插件治理: 响应异常");

    const governanceUpdate: OpenapiPluginGovernanceUpdateData = {
      plugin: "fixture",
      command_permission_overrides: { "fixture.run": "staff" },
      command_limit_overrides: { "fixture.run": 9 },
      blocked_user_ids: [77],
      runtime: { global_disable: false, global_disable_revision: "rev-2", help_hidden: false },
      future_update_value: { preserved: true },
    };
    transport.openapiPut.mockResolvedValueOnce(governanceUpdate);
    await expect(api.putPluginGovernance("fixture", {
      command_permission_overrides: { "fixture.run": "staff" },
      command_limit_overrides: { "fixture.run": 9 },
    })).resolves.toEqual(governanceUpdate);
    expect(transport.openapiPut).toHaveBeenCalledWith("/plugins/fixture/governance", {
      command_permission_overrides: { "fixture.run": "staff" },
      command_limit_overrides: { "fixture.run": 9 },
    });

    transport.openapiPut.mockResolvedValueOnce({
      ...governanceUpdate,
      runtime: { ...governanceUpdate.runtime, help_hidden: "false" },
    });
    await expect(api.putPluginGovernance("fixture", {})).rejects.toThrow("插件治理保存: 响应异常");
  });

  it("keeps raw common-config PUT responses as validated form payloads", async () => {
    const config = openapiConfig();
    transport.openapiPut.mockResolvedValue(config);
    transport.httpPut.mockResolvedValue({ data: { ok: true, data: config } });
    const { putCommonConfig, putCommonConfigRaw } = await import("./console");

    await expect(putCommonConfig("log_level", { log_level: "DEBUG" })).resolves.toEqual(config);
    expect(transport.openapiPut).toHaveBeenCalledWith("/common-config/log_level", {
      values: { log_level: "DEBUG" },
    });
    await expect(putCommonConfigRaw("log_level", "[env]\n")).resolves.toEqual(config);
    expect(transport.openapiPut).toHaveBeenCalledWith("/common-config/log_level/raw", { toml: "[env]\n" });
    expect(transport.httpPut).not.toHaveBeenCalled();
  });

  it("accepts nullable permission UI defaults returned by existing config routes", async () => {
    const config = { ...openapiConfig(), command_perm_ui: null, command_limits_ui: null };
    transport.openapiGet.mockResolvedValue(config);
    transport.openapiPut.mockResolvedValue(config);
    const api = await import("./consoleApi");
    await expect(api.fetchPluginConfig("fixture")).resolves.toEqual(config);
    await expect(api.fetchCommonConfig("log_level")).resolves.toEqual(config);
    await expect(api.putCommonConfigRaw("log_level", "[env]\n")).resolves.toEqual(config);
  });

  it("renders malformed config as an error instead of accepting a broken field", async () => {
    transport.openapiGet.mockResolvedValue({
      plugin: "log_level",
      module: "pallas.core.foundation.log_level_config",
      fields: [{ name: "broken" }],
    });
    transport.httpGet.mockResolvedValue({
      data: {
        ok: true,
        data: {
          plugin: "log_level",
          module: "pallas.core.foundation.log_level_config",
          fields: [{ name: "broken" }],
        },
      },
    });

    renderCommonConfig();

    expect(await screen.findByText(/加载失败：插件配置: 响应异常/)).toBeTruthy();
  });

  it("loads and saves through the contract client while failed saves keep the draft", async () => {
    const user = userEvent.setup();
    const config = openapiConfig();
    transport.openapiGet.mockResolvedValue(config);
    transport.openapiPut.mockRejectedValueOnce(new Error("offline"));
    transport.httpGet.mockResolvedValue({ data: { ok: true, data: config } });
    transport.httpPut.mockRejectedValue(new Error("legacy HTTP path used"));

    renderCommonConfig();
    const field = await screen.findByLabelText("log_level") as HTMLInputElement;
    await user.clear(field);
    await user.type(field, "DEBUG");
    await user.click(await screen.findByRole("button", { name: "保存" }));

    await waitFor(() => expect(transport.openapiPut).toHaveBeenCalledWith(
      "/common-config/log_level",
      { values: { log_level: "DEBUG" } },
    ));
    expect(field.value).toBe("DEBUG");
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(false);
    expect(transport.httpPut).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  transport.openapiGet.mockRejectedValue(new Error("Unexpected OpenAPI GET"));
  transport.openapiPut.mockRejectedValue(new Error("Unexpected OpenAPI PUT"));
  transport.httpGet.mockRejectedValue(new Error("Unexpected legacy GET"));
  transport.httpPut.mockRejectedValue(new Error("Unexpected legacy PUT"));
});

afterEach(cleanup);
