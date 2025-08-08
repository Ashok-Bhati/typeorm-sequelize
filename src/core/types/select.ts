import { ObjectLiteral } from "typeorm";

type RelationField<T, K extends keyof T> = T[K] extends Array<infer U>
  ? U extends ObjectLiteral ? U : never
  : T[K] extends ObjectLiteral ? T[K] : never;

type IsRelationType<T, K extends keyof T> = T[K] extends Array<ObjectLiteral> | ObjectLiteral ? K : never;
type IsScalarType<T, K extends keyof T> = T[K] extends Promise<any> | Date | Array<ObjectLiteral> | ObjectLiteral ? never : K;

export type RelationSelectorValue<T, K extends keyof T> = SelectJSON<RelationField<T, K>>;
export type ScalarSelectorValue<T> = { as: string };

export type SelectJSON<T> = {
  [K in keyof T as IsScalarType<T, K>]?: ScalarSelectorValue<T> | boolean;
} & {
  [K in keyof T as IsRelationType<T, K>]?: RelationSelectorValue<T, K>;
};
