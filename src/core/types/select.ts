export type SelectorValue = {
  as: string;
}

type FieldConditions<T> = {
  [K in keyof T as T[K] extends Function ? never : K]?: boolean | SelectorValue;
};

export type SelectJSON<T> = FieldConditions<T>;
