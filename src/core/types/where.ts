import { ObjectLiteral } from "typeorm";

type Operator =
  | '$eq'
  | '$ne'
  | '$lt'
  | '$lte'
  | '$gt'
  | '$gte'
  | '$in'
  | '$notIn'
  | '$between'
  | '$like'
  | '$iLike'
  | '$contains'
  | '$startsWith'
  | '$endsWith'
  | '$matches'
  | '$isNull'
  | '$isNotNull'
  | '$notLike'
  | '$notILike';

export type FieldComparison = {
  [op in Operator]?: string | number | boolean | null | (string | number)[];
};

type RelationField<T, K extends keyof T> = T[K] extends Array<infer U>
  ? U extends ObjectLiteral ? U : never
  : T[K] extends ObjectLiteral ? T[K] : never;

type IsRelationType<T, K extends keyof T> = T[K] extends Array<ObjectLiteral> | ObjectLiteral ? K : never;

type LogicalCondition<T> = {
  $and?: PredicateJSON<T>[];
  $or?: PredicateJSON<T>[];
};

type Fields<T> = {
  [K in keyof T as T[K] extends Function ? never : K]?: K extends IsRelationType<T, K> ? PredicateJSON<RelationField<T, K>> : FieldComparison;
};

export type PredicateJSON<T> = Fields<T> | LogicalCondition<T>;
