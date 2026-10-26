// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { PluginConfigField } from "@/api/console";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";

vi.mock("@/hooks/useBotFavorites", () => ({
  useBotFavorites: () => ({ favorites: new Set(), toggleFavorite: vi.fn() }),
}));

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

function renderFields(fields: Array<{ field: PluginConfigField; value?: string }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {fields.map(({ field: configField, value }, index) => (
        <PluginConfigFieldShell
          key={`${configField.name}-${index}`}
          field={configField}
          modelValue={value ?? String(configField.current ?? "")}
          onValueChange={vi.fn()}
        />
      ))}
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

it("labels text, numeric, secret, raw JSON, multiline and switch controls with unique ids and descriptions", async () => {
  const user = userEvent.setup();
  renderFields([
    { field: field({ name: "text", label: "Text field" }) },
    { field: field({ name: "number", label: "Number field", kind: "int" }) },
    { field: field({ name: "secret", label: "Secret field", secret: true }) },
    { field: field({ name: "json", label: "JSON field", kind: "json" }), value: "not valid json" },
    { field: field({ name: "multiline", label: "Multiline field", multiline: true }) },
    { field: field({ name: "enabled", label: "Enabled field", kind: "bool" }), value: "true" },
  ]);

  const labels = ["Text field", "Number field", "Secret field", "JSON field", "Multiline field"];
  const controls = labels.map((label) => screen.getByLabelText(label));
  const ids = controls.map((control) => control.id);
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);

  for (const [index, label] of labels.entries()) {
    const control = controls[index];
    const descriptionId = control.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toContain("用于测试字段描述。");
    await user.click(screen.getByText(label, { selector: "label" }));
    expect(document.activeElement).toBe(control);
  }

  const switchControl = screen.getByRole("checkbox", { name: "Enabled field" });
  expect(switchControl.getAttribute("id")).toBeTruthy();
  expect(switchControl.getAttribute("aria-describedby")).toBeTruthy();
});

it("keeps same-name editors distinct and does not attach empty descriptions", () => {
  renderFields([
    { field: field({ name: "duplicate", label: "Duplicate field", description: "" }) },
    { field: field({ name: "duplicate", label: "Duplicate field", description: "" }) },
  ]);

  const controls = screen.getAllByLabelText("Duplicate field");
  expect(controls).toHaveLength(2);
  expect(controls[0].id).not.toBe(controls[1].id);
  expect(controls[0].getAttribute("aria-describedby")).toBeNull();
  expect(controls[1].getAttribute("aria-describedby")).toBeNull();
});

it("associates the renderer-owned visible title with its control", async () => {
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConfigFieldRenderer field={field({ label: "Renderer-owned field" })} modelValue="initial" onValueChange={vi.fn()} />
    </QueryClientProvider>,
  );

  const control = screen.getByLabelText("Renderer-owned field");
  expect(control.id).toBeTruthy();
  const descriptionId = control.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  expect(document.getElementById(descriptionId!)?.textContent).toBe("用于测试字段描述。");
  await user.click(screen.getByText("Renderer-owned field", { selector: "label" }));
  expect(document.activeElement).toBe(control);
});

it("associates renderer descriptions with simple and composite controls without dangling or duplicate ids", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConfigFieldRenderer
        id="simple-field"
        field={field({ label: "Simple field" })}
        modelValue="value"
        onValueChange={vi.fn()}
        ariaDescribedBy="external-description simple-field-description external-description"
      />
      <p id="external-description">External description.</p>
      <ConfigFieldRenderer
        id="composite-field"
        field={field({ name: "aliases", label: "Composite field", kind: "json" })}
        modelValue="{}"
        onValueChange={vi.fn()}
      />
      <ConfigFieldRenderer
        id="empty-field"
        field={field({ label: "Undescribed field", description: "   " })}
        modelValue="value"
        onValueChange={vi.fn()}
      />
    </QueryClientProvider>,
  );

  const simpleControl = screen.getByLabelText("Simple field");
  expect(simpleControl.getAttribute("aria-describedby")).toBe("external-description simple-field-description");
  expect(document.getElementById("external-description")?.textContent).toBe("External description.");
  expect(document.getElementById("simple-field-description")?.textContent).toBe("用于测试字段描述。");

  const compositeGroup = screen.getByRole("group", { name: "Composite field" });
  expect(compositeGroup.getAttribute("aria-describedby")).toBe("composite-field-description");
  expect(document.getElementById("composite-field-description")?.textContent).toBe("用于测试字段描述。");

  const undescribedControl = screen.getByLabelText("Undescribed field");
  expect(undescribedControl.getAttribute("aria-describedby")).toBeNull();
  expect(document.getElementById("empty-field-description")).toBeNull();
});
