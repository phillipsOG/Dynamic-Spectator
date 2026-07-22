/**
 * Minimal ambient declarations for the slice of the Foundry VTT + PIXI runtime
 * that this module actually touches.
 *
 * Rationale: the full community type packages (foundry-vtt-types / fvtt-types)
 * are enormous, version-sensitive, and frequently lag the current core release.
 * We only want the compiler to check *our* code, so we declare the handful of
 * globals and shapes we depend on and leave deep core internals as `any`.
 * Everything here is intentionally loose where the core API is sprawling - the
 * goal is catching our own mistakes, not modelling all of Foundry.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export {};

declare global {
  // ---- Core singletons -----------------------------------------------------
  const game: FoundryGame;
  const ui: FoundryUI;
  const canvas: FoundryCanvas;
  const CONFIG: Record<string, any>;
  const CONST: Record<string, any>;
  const Hooks: FoundryHooks;
  const foundry: FoundryNamespace;

  // Optional third-party helpers (feature-detected at runtime).
  const libWrapper: LibWrapper | undefined;
  const Handlebars: {
    registerHelper(name: string, fn: (...args: any[]) => any): void;
  };

  // Foundry ships PIXI on the global scope; we use a permissive shape.
  const PIXI: typeof PixiNS;

  interface Window {
    DynamicSpectator?: unknown;
    libWrapper?: LibWrapper;
  }

  // ---- Shapes --------------------------------------------------------------

  interface FoundryGame {
    ready: boolean;
    paused: boolean;
    user: FoundryUser;
    users: FoundryCollection<FoundryUser>;
    settings: FoundrySettings;
    keybindings: FoundryKeybindings;
    modules: FoundryCollection<{ id: string; active: boolean; api?: any }>;
    system: { id: string; version: string };
    version: string;
    socket: { on(event: string, cb: (...args: any[]) => void): void; emit(event: string, ...args: any[]): void } | null;
    combats?: FoundryCollection<any>;
    combat?: any;
    scenes: FoundryCollection<FoundryScene> & { current?: FoundryScene; active?: FoundryScene };
    i18n: { localize(key: string): string; format(key: string, data: Record<string, any>): string };
    [key: string]: any;
  }

  interface FoundryUser {
    id: string;
    name: string;
    isGM: boolean;
    color: string | { css: string };
    character?: FoundryActor | null;
    active: boolean;
    can(action: string): boolean;
    [key: string]: any;
  }

  interface FoundrySettings {
    register(namespace: string, key: string, data: Record<string, any>): void;
    registerMenu(namespace: string, key: string, data: Record<string, any>): void;
    get(namespace: string, key: string): any;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
    /** The core "Configure Settings" application; present once at least one setting is registered. */
    sheet?: { render(force?: boolean, options?: Record<string, any>): unknown };
  }

  interface FoundryKeybindings {
    register(namespace: string, action: string, data: Record<string, any>): void;
  }

  interface FoundryUI {
    notifications: {
      info(msg: string, opts?: any): void;
      warn(msg: string, opts?: any): void;
      error(msg: string, opts?: any): void;
    };
    controls?: any;
    windows: Record<string, any>;
    [key: string]: any;
  }

  interface FoundryHooks {
    on(hook: string, fn: (...args: any[]) => any): number;
    once(hook: string, fn: (...args: any[]) => any): number;
    off(hook: string, id: number | ((...args: any[]) => any)): void;
    call(hook: string, ...args: any[]): boolean;
    callAll(hook: string, ...args: any[]): boolean;
  }

  interface FoundryNamespace {
    utils: {
      randomID(length?: number): string;
      mergeObject<T>(original: T, other: Partial<T>, options?: any): T;
      deepClone<T>(obj: T): T;
      debounce<T extends (...a: any[]) => any>(fn: T, delay: number): T;
      getProperty(obj: any, key: string): any;
      setProperty(obj: any, key: string, value: any): boolean;
    };
    applications: {
      api: {
        ApplicationV2: any;
        HandlebarsApplicationMixin: (base: any) => any;
        DialogV2: any;
      };
    };
    canvas?: any;
    [key: string]: any;
  }

  interface FoundryCollection<T> extends Iterable<T> {
    get(id: string): T | undefined;
    find(fn: (v: T) => boolean): T | undefined;
    filter(fn: (v: T) => boolean): T[];
    map<U>(fn: (v: T) => U): U[];
    forEach(fn: (v: T) => void): void;
    contents: T[];
    size: number;
    [Symbol.iterator](): Iterator<T>;
  }

  // ---- Canvas / documents (kept permissive) --------------------------------

  interface FoundryCanvas {
    ready: boolean;
    scene: FoundryScene | null;
    app: PixiApplication;
    stage: PixiContainer;
    dimensions: { width: number; height: number; size: number; sceneRect: PixiRectangle };
    tokens: FoundryLayer & { get(id: string): FoundryToken | undefined; placeables: FoundryToken[]; controlled: FoundryToken[] };
    effects: any;
    visibility: any;
    perception: FoundryPerception;
    fog?: any;
    lighting?: any;
    grid: { size: number; sizeX?: number; sizeY?: number };
    animatePan(view: Partial<CanvasView>): Promise<void>;
    pan(view: Partial<CanvasView>): void;
    getWorldPosition?(): any;
    [key: string]: any;
  }

  interface FoundryPerception {
    update(flags: Record<string, boolean>, v2?: boolean): void;
    refresh?(): void;
    [key: string]: any;
  }

  interface CanvasView {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    duration: number;
  }

  interface FoundryLayer {
    [key: string]: any;
  }

  interface FoundryToken {
    id: string;
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    center: { x: number; y: number };
    document: FoundryTokenDocument;
    actor: FoundryActor | null;
    vision?: any;
    visible: boolean;
    controlled: boolean;
    isOwner: boolean;
    _isVisionSource?(): boolean;
    updateVisionSource?(opts?: any): void;
    initializeVisionSource?(opts?: any): void;
    [key: string]: any;
  }

  interface FoundryTokenDocument {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elevation: number;
    hidden: boolean;
    disposition: number;
    sight: { enabled: boolean; range: number; visionMode?: string; [k: string]: any };
    actorId?: string;
    actor?: FoundryActor | null;
    parent?: FoundryScene;
    testUserPermission(user: FoundryUser, level: string | number): boolean;
    getFlag(scope: string, key: string): any;
    setFlag(scope: string, key: string, value: unknown): Promise<any>;
    unsetFlag(scope: string, key: string): Promise<any>;
    [key: string]: any;
  }

  interface FoundryActor {
    id: string;
    name: string;
    type: string;
    system: any;
    img: string;
    hasPlayerOwner: boolean;
    ownership: Record<string, number>;
    [key: string]: any;
  }

  interface FoundryScene {
    id: string;
    name: string;
    active: boolean;
    tokens: FoundryCollection<FoundryTokenDocument>;
    [key: string]: any;
  }

  interface LibWrapper {
    register(
      module: string,
      target: string,
      fn: (this: unknown, wrapped: (...a: any[]) => any, ...args: any[]) => any,
      type?: "WRAPPER" | "MIXED" | "OVERRIDE"
    ): number;
    unregister(module: string, target: string | number): void;
    WRAPPER: "WRAPPER";
    MIXED: "MIXED";
    OVERRIDE: "OVERRIDE";
  }

  // ---- Minimal PIXI surface ------------------------------------------------

  namespace PixiNS {
    class Application {
      renderer: PixiRenderer;
      stage: PixiContainer;
      ticker: { add(fn: (dt: number) => void): void; remove(fn: (dt: number) => void): void };
      view: HTMLCanvasElement;
      destroy(removeView?: boolean, options?: any): void;
    }
    class Renderer {
      render(displayObject: any, options?: any): void;
      resize(w: number, h: number): void;
      width: number;
      height: number;
      plugins: any;
    }
    class Container {
      addChild<T>(child: T): T;
      removeChild(child: any): any;
      position: { set(x: number, y: number): void; x: number; y: number };
      pivot: { set(x: number, y: number): void; x: number; y: number };
      scale: { set(x: number, y?: number): void; x: number; y: number };
      rotation: number;
      visible: boolean;
      destroy(options?: any): void;
      [key: string]: any;
    }
    class Sprite {
      constructor(texture?: any);
      texture: any;
      width: number;
      height: number;
      visible: boolean;
      position: { set(x: number, y: number): void };
      destroy(options?: any): void;
    }
    class RenderTexture {
      static create(options: { width: number; height: number; resolution?: number }): RenderTexture;
      width: number;
      height: number;
      resize(w: number, h: number, resolution?: number): void;
      destroy(destroyBase?: boolean): void;
    }
    class Rectangle {
      constructor(x?: number, y?: number, w?: number, h?: number);
      x: number;
      y: number;
      width: number;
      height: number;
    }
    class Matrix {
      constructor();
      set(a: number, b: number, c: number, d: number, tx: number, ty: number): this;
    }
  }

  type PixiApplication = PixiNS.Application;
  type PixiRenderer = PixiNS.Renderer;
  type PixiContainer = PixiNS.Container;
  type PixiRectangle = PixiNS.Rectangle;
}
