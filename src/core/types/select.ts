import { ObjectLiteral } from "typeorm";

type RelationField<T, K extends keyof T> = T[K] extends Array<infer U>
  ? U extends ObjectLiteral ? U : never
  : T[K] extends ObjectLiteral ? T[K] : never;

type IsRelationType<T, K extends keyof T> = T[K] extends Array<ObjectLiteral> | ObjectLiteral ? K : never;

export type RelationSelectorValue<T, K extends keyof T> = SelectJSON<RelationField<T, K>>;
export type ScalarSelectorValue<T> = { as: string };

export type SelectJSON<T> = {
  [K in keyof T as T[K] extends Function ? never : K]?: K extends IsRelationType<T, K> ? RelationSelectorValue<T, K> : ScalarSelectorValue<T> | boolean;
};
