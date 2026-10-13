// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { PluginConfigField } from "@/api/console";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import SettingsFormField from "@/components/config/SettingsFormField";
import UiField from "@/components/ui/UiField";

vi.mock("@/hooks/useBotFavorites", () => ({
  useBotFavorites: () => ({ favorites: new Set(), toggleFavorite: vi.fn() }),
}));

afterEach(cleanup);

function field(overrides: Partial<PluginConfigField>): PluginConfigField {
  return {
    name: "fixture_value",
    kind: "string",
    required: false,
    description: "用于测试字段描述。",
    env_key: "FIXTURE_VALUE",
    label: "Fixture value",
    default: "",
    current: "initial",
    ...overrides,
  } as PluginConfigField;
}

function renderShell(configField: PluginConfigField) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PluginConfigFieldShell field={configField} modelValue="initial" onValueChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

it("associates the label with its control and renders prefix, suffix and meta", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <UiField
      label="Display name"
      htmlFor="display-name"
      labelStart={<span data-testid="prefix">P</span>}
      labelEnd={<span data-testid="suffix">S</span>}
      meta={<span data-testid="meta">meta</span>}
    >
      <input id="display-name" />
    </UiField>,
  );

  const label = screen.getByText("Display name", { selector: "label" });
  expect(label.getAttribute("for")).toBe("display-name");
  // Rendered through the HeroUI v3 Label primitive.
  expect(label.getAttribute("data-slot")).toBe("label");
  expect(label.className).toContain("label");
  expect(screen.getByTestId("prefix")).toBeTruthy();
  expect(screen.getByTestId("suffix")).toBeTruthy();
  expect(screen.getByTestId("meta")).toBeTruthy();
  expect(container.querySelector(".ui-field__control")?.querySelector("input")).toBeTruthy();

  await user.click(label);
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
});

it("renders the required marker and the secret badge without polluting the label text", () => {
  render(
    <UiField label="API token" required secret htmlFor="api-token">
      <input id="api-token" />
    </UiField>,
  );

  const label = screen.getByText("API token", { selector: "label" });
  expect(label.textContent).toBe("API token");
  expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("密钥")).toBeTruthy();
});

it("suppresses the whole label row when hideLabel is set", () => {
  const { container } = render(
    <UiField label="Hidden title" hideLabel htmlFor="hidden">
      <input id="hidden" aria-label="Hidden control" />
    </UiField>,
  );

  expect(container.querySelector(".ui-field__label-row")).toBeNull();
  expect(screen.queryByText("Hidden title", { selector: "label" })).toBeNull();
  expect(screen.getByLabelText("Hidden control")).toBeTruthy();
});

it("renders no label row when no label content is provided", () => {
  const { container } = render(
    <UiField>
      <input aria-label="Bare control" />
    </UiField>,
  );

  expect(container.querySelector(".ui-field__label-row")).toBeNull();
  expect(screen.getByLabelText("Bare control")).toBeTruthy();
});

it("applies labelId and the merged root className", () => {
  const { container } = render(
    <UiField label="With id" labelId="field-label" className="custom-field">
      <input aria-label="With id control" />
    </UiField>,
  );

  expect(screen.getByText("With id", { selector: "label" }).id).toBe("field-label");
  expect(container.querySelector(".ui-field")?.className).toContain("custom-field");
});

it("renders a bold SettingsFormField label and only shows help when a hint exists", () => {
  const { rerender } = render(
    <SettingsFormField label="Setting title" hint="Some hint">
      <input aria-label="Setting control" />
    </SettingsFormField>,
  );

  expect(screen.getByText("Setting title", { selector: "label" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "查看 Setting title 说明" })).toBeTruthy();

  rerender(
    <SettingsFormField label="No hint">
      <input aria-label="No hint control" />
    </SettingsFormField>,
  );
  expect(screen.queryByRole("button", { name: "查看 No hint 说明" })).toBeNull();
});

it("forwards the secret badge through SettingsFormField", () => {
  render(
    <SettingsFormField label="Secret setting" secret>
      <input aria-label="Secret control" />
    </SettingsFormField>,
  );

  expect(screen.getByText("密钥")).toBeTruthy();
});

it("wires PluginConfigFieldShell title, required and secret markers with the labelled control", () => {
  const { container } = renderShell(
    field({ name: "token", label: "Token field", required: true, secret: true }),
  );

  const control = screen.getByLabelText("Token field");
  expect(control.id).toBeTruthy();
  expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("密钥")).toBeTruthy();
  expect(container.querySelector(".plugin-config-form-item__label-icon")).toBeTruthy();
  expect(screen.getByRole("button", { name: "查看 Token field 说明" })).toBeTruthy();
});

it("keeps PluginConfigFieldShell controls distinct and labelled across repeated fields", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PluginConfigFieldShell field={field({ name: "duplicate", label: "Duplicate field" })} modelValue="a" onValueChange={vi.fn()} />
      <PluginConfigFieldShell field={field({ name: "duplicate", label: "Duplicate field" })} modelValue="b" onValueChange={vi.fn()} />
    </QueryClientProvider>,
  );

  const controls = screen.getAllByLabelText("Duplicate field");
  expect(controls).toHaveLength(2);
  expect(controls[0].id).not.toBe(controls[1].id);
});
