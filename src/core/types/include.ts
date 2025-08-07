import { ObjectLiteral } from "typeorm";

type RelationField<T, K extends keyof T> = T[K] extends Array<infer U>
  ? U extends ObjectLiteral ? U : never
  : T[K] extends ObjectLiteral ? T[K] : never;

export type IncludeValue<T, K extends keyof T> = {
  as?: string;
  include?: IncludeJSON<RelationField<T, K>>;
};

export type IsRelation<T, K extends keyof T> = 
  T[K] extends Function ? never :
  T[K] extends Promise<any> ? never :
  T[K] extends Date ? never :
  T[K] extends ObjectLiteral | Array<ObjectLiteral> ? K : never;

export type IncludeJSON<T> = {
  [K in keyof T as IsRelation<T, K>]?: boolean | IncludeValue<T, K>;
};
