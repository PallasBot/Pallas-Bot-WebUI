// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Save } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

afterEach(cleanup);

describe("Button", () => {
  it("keeps the native submit default when type is omitted", () => {
    render(<form><Button>Submit</Button></form>);

    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).type).toBe("submit");
  });

  it("forwards native button props and click events", async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLButtonElement>();
    let clickTarget: HTMLButtonElement | null = null;
    let hasPreventDefault = false;
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      clickTarget = event.currentTarget;
      hasPreventDefault = typeof event.preventDefault === "function";
    });
    render(<Button ref={ref} type="button" aria-label="Save changes" onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(ref.current).toBe(button);
    expect(button.getAttribute("type")).toBe("button");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(clickTarget).toBe(button);
    expect(hasPreventDefault).toBe(true);
  });

  it("preserves an explicit accessibility role", () => {
    render(<Button role="combobox" aria-label="Docker 镜像">Docker 镜像</Button>);

    expect(screen.getByRole("combobox", { name: "Docker 镜像" })).toBeTruthy();
  });

  it("preserves variant and size layout classes", () => {
    render(<Button variant="outline" size="sm">Outline small</Button>);
    const button = screen.getByRole("button", { name: "Outline small" });
    expect(button.className).toContain("bg-[var(--control-bg,#fff)]");
    expect(button.className).toContain("h-8");
    expect(button.className).toContain("text-xs");
  });

  it("keeps link text accent-colored without a ghost hover fill", () => {
    render(<Button variant="link">Details</Button>);
    const button = screen.getByRole("button", { name: "Details" });

    expect(button.className).toContain("text-[var(--accent)]");
    expect(button.className).toContain("bg-transparent");
    expect(button.className).toContain("hover:underline");
  });

  it("invokes the public click handler once when Enter activates a submit button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<form onSubmit={(event) => event.preventDefault()}><Button type="submit" onClick={onClick}>Activate</Button></form>);

    const button = screen.getByRole("button", { name: "Activate" });
    button.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("invokes the public click handler once when Space activates a submit button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<form onSubmit={(event) => event.preventDefault()}><Button type="submit" onClick={onClick}>Activate</Button></form>);

    const button = screen.getByRole("button", { name: "Activate" });
    button.focus();
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("lets public onClick prevent form submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault());
    render(<form onSubmit={onSubmit}><Button type="submit" onClick={onClick}>Save</Button></form>);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not invoke clicks when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Unavailable</Button>);

    const button = screen.getByRole("button", { name: "Unavailable" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a plain native button and lets clicks bubble to ancestors", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    const onClick = vi.fn();
    render(<div onClick={parentClick}><Button type="button" onClick={onClick}>Bubble</Button></div>);

    const button = screen.getByRole("button", { name: "Bubble" });
    expect(button.tagName).toBe("BUTTON");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(parentClick).toHaveBeenCalledTimes(1);
  });

  it("forwards value and focus/blur handlers unchanged", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onFocusCapture = vi.fn();
    const onBlurCapture = vi.fn();
    render(<Button type="button" value="42" onFocus={onFocus} onBlur={onBlur} onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}>Focusable</Button>);

    const button = screen.getByRole("button", { name: "Focusable" }) as HTMLButtonElement;
    expect(button.value).toBe("42");
    button.focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusCapture).toHaveBeenCalledTimes(1);
    button.blur();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlurCapture).toHaveBeenCalledTimes(1);
  });

  it("renders the leading icon and group class when icon is provided", () => {
    render(<Button type="button" icon={Save} aria-label="Save icon">Save</Button>);

    const button = screen.getByRole("button", { name: "Save icon" });
    expect(button.className).toContain("group");
    expect(button.querySelector("svg")).toBeTruthy();
  });

  it("supports Slot composition with links", async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(<Button ref={ref} asChild><a href="/settings" onClick={(event) => { event.preventDefault(); onClick(); }}>Settings</a></Button>);

    const link = screen.getByRole("link", { name: "Settings" });
    expect(ref.current).toBe(link);
    expect(link.getAttribute("href")).toBe("/settings");
    await user.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Input and Textarea", () => {
  it("forwards input value, native props, and change events", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Account name" placeholder="Name" defaultValue="first" data-field="account" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "Account name" }) as HTMLInputElement;
    expect(input.placeholder).toBe("Name");
    expect(input.value).toBe("first");
    expect(input.getAttribute("data-field")).toBe("account");
    await user.type(input, "2");
    expect(input.value).toBe("first2");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards textarea value, native props, and change events", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea aria-label="Notes" placeholder="Add notes" defaultValue="Initial" rows={4} onChange={onChange} />);

    const textarea = screen.getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe("Add notes");
    expect(textarea.rows).toBe(4);
    expect(textarea.value).toBe("Initial");
    await user.type(textarea, " text");
    expect(textarea.value).toBe("Initial text");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Checkbox and Switch", () => {
  it("supports controlled checkbox changes and an associated Label", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function ControlledCheckbox() {
      const [checked, setChecked] = React.useState(false);
      return (
        <>
          <Label htmlFor="terms">Accept terms</Label>
          <Checkbox id="terms" checked={checked} onCheckedChange={(next) => { onCheckedChange(next); setChecked(next === true); }} />
        </>
      );
    }
    render(<ControlledCheckbox />);

    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    checkbox.focus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

  it("supports uncontrolled checkbox state", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Remember me" defaultChecked />);
    const checkbox = screen.getByRole("checkbox", { name: "Remember me" });

    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    await user.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

  it("renders the Check glyph only while selected", () => {
    const { container } = render(
      <>
        <div data-testid="checked"><Checkbox aria-label="Checked" checked /></div>
        <div data-testid="unchecked"><Checkbox aria-label="Unchecked" checked={false} /></div>
      </>,
    );

    expect(container.querySelector('[data-testid="checked"] svg')).toBeTruthy();
    expect(container.querySelector('[data-testid="unchecked"] svg')).toBeNull();
  });

  it("supports controlled Switch state and label association", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function ControlledSwitch() {
      const [checked, setChecked] = React.useState(false);
      return (
        <>
          <Label id="alerts-label" htmlFor="alerts">Enable alerts</Label>
          <Switch id="alerts" aria-labelledby="alerts-label" checked={checked} onCheckedChange={(next) => { onCheckedChange(next); setChecked(next); }} />
        </>
      );
    }
    render(<ControlledSwitch />);

    const toggle = screen.getByRole("checkbox", { name: "Enable alerts" }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await user.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(toggle.checked).toBe(true);
  });

  it("supports uncontrolled Switch state", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Developer mode" defaultChecked />);
    const toggle = screen.getByRole("checkbox", { name: "Developer mode" }) as HTMLInputElement;

    expect(toggle.checked).toBe(true);
    await user.click(toggle);
    expect(toggle.checked).toBe(false);
  });

  it("forwards keyboard events from the native label, including Space", async () => {
    const user = userEvent.setup();
    const keyboardEvents: Array<{ key: string; currentTarget: EventTarget }> = [];
    const onKeyDown = vi.fn((event: React.KeyboardEvent<HTMLLabelElement>) => {
      keyboardEvents.push({ key: event.key, currentTarget: event.currentTarget });
    });
    render(<Switch aria-label="Keyboard switch" onKeyDown={onKeyDown} />);

    const toggle = screen.getByRole("checkbox", { name: "Keyboard switch" });
    toggle.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onKeyDown).toHaveBeenCalled();
    expect(keyboardEvents.map(({ key }) => key)).toEqual(expect.arrayContaining(["Enter", " "]));
    expect(keyboardEvents.every(({ currentTarget }) => currentTarget instanceof HTMLLabelElement)).toBe(true);
  });
});

describe("Label", () => {
  it("associates its htmlFor with a form control", () => {
    render(<><Label htmlFor="email">Email address</Label><Input id="email" /></>);
    expect(screen.getByLabelText("Email address").id).toBe("email");
  });

  it("keeps asChild label association and its ref", () => {
    const ref = React.createRef<HTMLLabelElement>();
    render(<><Label asChild ref={ref}><label htmlFor="custom-email">Email</label></Label><input id="custom-email" /></>);

    expect(ref.current).toBe(screen.getByText("Email"));
    expect(screen.getByLabelText("Email").id).toBe("custom-email");
  });
});

describe("Tabs", () => {
  it("keeps keyboard activation and tab-to-panel IDs", async () => {
    const user = userEvent.setup();
    render(<Tabs defaultValue="overview">
      <TabsList aria-label="Sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="details">Details panel</TabsContent>
    </Tabs>);

    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    await user.keyboard("{ArrowRight}");
    const details = screen.getByRole("tab", { name: "Details" });
    expect(details.getAttribute("aria-selected")).toBe("true");
    const panel = document.getElementById(details.getAttribute("aria-controls") ?? "");
    expect(panel?.getAttribute("role")).toBe("tabpanel");
    expect(panel?.textContent).toContain("Details panel");
  });
});

describe("Card", () => {
  it("composes header, title, description, content, and footer", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Account details</CardDescription>
        </CardHeader>
        <CardContent>Profile content</CardContent>
        <CardFooter>Save controls</CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading", { name: "Account", level: 3 })).toBeTruthy();
    expect(screen.getByText("Account details")).toBeTruthy();
    expect(screen.getByText("Profile content")).toBeTruthy();
    expect(screen.getByText("Save controls")).toBeTruthy();

    const card = container.firstElementChild as HTMLElement;
    const header = screen.getByRole("heading", { name: "Account", level: 3 }).parentElement as HTMLElement;
    const content = screen.getByText("Profile content") as HTMLElement;
    const footer = screen.getByText("Save controls") as HTMLElement;
    expect(card.tagName).toBe("DIV");
    expect(card.classList).toContain("rounded-lg");
    expect(card.classList).toContain("bg-card");
    expect(card.classList).toContain("text-card-foreground");
    expect(card.classList).toContain("shadow-none");
    expect(header.classList).toContain("space-y-1.5");
    expect(header.classList).toContain("p-5");
    expect(content.classList).toContain("p-5");
    expect(content.classList).toContain("pt-0");
    expect(footer.classList).toContain("items-center");
    expect(footer.classList).toContain("p-5");
    expect(footer.classList).toContain("pt-0");
  });

  it("keeps caller layout classes and the native element ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    const { container } = render(<Card ref={ref} className="flex relative gap-4 p-6">Flexible</Card>);
    const card = container.firstElementChild as HTMLDivElement;

    expect(ref.current).toBe(card);
    expect(card.classList).toContain("flex");
    expect(card.classList).toContain("relative");
    expect(card.classList).toContain("gap-4");
    expect(card.classList).toContain("p-6");
    expect(card.classList).not.toContain("static");
    expect(card.classList).not.toContain("p-0");
  });
});

describe("Table", () => {
  it("renders semantic table sections with an accessible label", () => {
    render(
      <Table aria-label="Installed plugins">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Core</TableCell>
            <TableCell>Ready</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole("table", { name: "Installed plugins" });
    expect(table.querySelector("thead")).toBeTruthy();
    expect(table.querySelector("tbody")).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "Ready" })).toBeTruthy();
  });

  it("keeps the six-column span used by expandable tool rows", () => {
    render(
      <Table aria-label="Expandable tools">
        <TableHeader>
          <TableRow>
            <TableHead>One</TableHead>
            <TableHead>Two</TableHead>
            <TableHead>Three</TableHead>
            <TableHead>Four</TableHead>
            <TableHead>Five</TableHead>
            <TableHead>Six</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Tool</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Domain</TableCell>
            <TableCell>Hints</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={6}>Expanded editor</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("cell", { name: "Expanded editor" }).getAttribute("colspan")).toBe("6");
  });
});
