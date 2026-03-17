import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => cleanup());

describe("getToolLabel", () => {
  describe("str_replace_editor", () => {
    it("returns Creating <filename> for create command", () => {
      expect(getToolLabel("str_replace_editor", { command: "create", path: "src/components/Card.tsx" })).toBe("Creating Card.tsx");
    });

    it("returns Editing <filename> for str_replace command", () => {
      expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "src/components/Card.tsx" })).toBe("Editing Card.tsx");
    });

    it("returns Editing <filename> for insert command", () => {
      expect(getToolLabel("str_replace_editor", { command: "insert", path: "src/App.tsx" })).toBe("Editing App.tsx");
    });

    it("returns Reading <filename> for view command", () => {
      expect(getToolLabel("str_replace_editor", { command: "view", path: "src/index.ts" })).toBe("Reading index.ts");
    });

    it("returns Processing <filename> for unknown command", () => {
      expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "src/foo.ts" })).toBe("Processing foo.ts");
    });
  });

  describe("file_manager", () => {
    it("returns Renaming <filename> for rename command", () => {
      expect(getToolLabel("file_manager", { command: "rename", path: "src/Old.tsx" })).toBe("Renaming Old.tsx");
    });

    it("returns Deleting <filename> for delete command", () => {
      expect(getToolLabel("file_manager", { command: "delete", path: "src/Unused.tsx" })).toBe("Deleting Unused.tsx");
    });
  });

  it("returns the tool name for unknown tools", () => {
    expect(getToolLabel("some_other_tool", { path: "src/foo.ts" })).toBe("some_other_tool");
  });

  it("handles a flat filename with no directory", () => {
    expect(getToolLabel("str_replace_editor", { command: "create", path: "App.tsx" })).toBe("Creating App.tsx");
  });
});

describe("ToolCallBadge", () => {
  function makeTool(overrides: Partial<ToolInvocation>): ToolInvocation {
    return {
      state: "call",
      toolCallId: "test-id",
      toolName: "str_replace_editor",
      args: { command: "create", path: "src/components/Button.tsx" },
      ...overrides,
    } as ToolInvocation;
  }

  it("shows a friendly label while loading", () => {
    render(<ToolCallBadge tool={makeTool({ state: "call" })} />);
    expect(screen.getByText("Creating Button.tsx")).toBeDefined();
  });

  it("shows a friendly label when done", () => {
    render(<ToolCallBadge tool={makeTool({ state: "result" })} />);
    expect(screen.getByText("Creating Button.tsx")).toBeDefined();
  });

  it("shows spinner while loading", () => {
    const { container } = render(<ToolCallBadge tool={makeTool({ state: "call" })} />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows green dot when done", () => {
    const { container } = render(<ToolCallBadge tool={makeTool({ state: "result" })} />);
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("shows Editing label for str_replace command", () => {
    render(<ToolCallBadge tool={makeTool({ args: { command: "str_replace", path: "src/App.tsx" } })} />);
    expect(screen.getByText("Editing App.tsx")).toBeDefined();
  });

  it("shows Deleting label for file_manager delete", () => {
    render(
      <ToolCallBadge
        tool={makeTool({ toolName: "file_manager", args: { command: "delete", path: "src/Old.tsx" } })}
      />
    );
    expect(screen.getByText("Deleting Old.tsx")).toBeDefined();
  });
});
