declare module "vis-timeline/standalone" {
  export class DataSet<T extends Record<string, unknown> = Record<string, unknown>> {
    constructor(data?: T[]);
    add(data: T | T[]): void;
    clear(): void;
    get(id: string | number): T | null;
    getIds(): Array<string | number>;
    update(data: T | T[]): void;
  }

  export class Timeline {
    constructor(
      container: HTMLElement,
      items: DataSet,
      groups: unknown,
      options?: Record<string, unknown>,
    );
    on(event: string, handler: (props: { items: string[] }) => void): void;
    focus(id: string, options?: Record<string, unknown>): void;
    fit(options?: Record<string, unknown>): void;
    setSelection(ids: string[]): void;
    destroy(): void;
  }
}
