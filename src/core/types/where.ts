import { ObjectLiteral } from "typeorm";

/**
 * Operator Types with stricter value constraints per operator
 */
type EqOp = { $eq?: string | number | boolean | null };
type NeOp = { $ne?: string | number | boolean | null };
type LtOp = { $lt?: number | string };
type LteOp = { $lte?: number | string };
type GtOp = { $gt?: number | string };
type GteOp = { $gte?: number | string };
type InOp = { $in?: Array<string | number> };
type NotInOp = { $notIn?: Array<string | number> };
type BetweenOp = { $between?: [string | number, string | number] };
type LikeOp = { $like?: string };
type ILikeOp = { $iLike?: string };
type ContainsOp = { $contains?: string };
type StartsWithOp = { $startsWith?: string };
type EndsWithOp = { $endsWith?: string };
type MatchesOp = { $matches?: string | RegExp };
type IsNullOp = { $isNull?: boolean };
type IsNotNullOp = { $isNotNull?: boolean };
type NotLikeOp = { $notLike?: string };
type NotILikeOp = { $notILike?: string };

/**
 * Logical operators inside fields to support nested AND/OR conditions
 */
type LogicalOperators = {
  $or?: FieldComparison[];
};

/**
 * FieldComparison type combining all operators and nested logical operators
 */
export type FieldComparison = (
  EqOp &
  NeOp &
  LtOp &
  LteOp &
  GtOp &
  GteOp &
  InOp &
  NotInOp &
  BetweenOp &
  LikeOp &
  ILikeOp &
  ContainsOp &
  StartsWithOp &
  EndsWithOp &
  MatchesOp &
  IsNullOp &
  IsNotNullOp &
  NotLikeOp &
  NotILikeOp
) & LogicalOperators;

/**
 * Extract the type of a relation property (single object or array of objects)
 */
type RelationField<T, K extends keyof T> =
  T[K] extends Array<infer U>
    ? U extends ObjectLiteral ? U : never
    : T[K] extends ObjectLiteral ? T[K] : never;

/**
 * Conditionally returns the key if it represents a relation (object or array of objects)
 */
type IsRelationType<T, K extends keyof T> =
  T[K] extends Array<ObjectLiteral> | ObjectLiteral ? K : never;

/**
 * Maps a type T to an object type suitable for building query filters.
 * For relation fields, recursion to nested Fields; for others, FieldComparison.
 * Skips function properties.
 */
export type Fields<T> = {
  [K in keyof T as T[K] extends Function ? never : K]?:
    K extends IsRelationType<T, K>
      ? Fields<RelationField<T, K>>
      : FieldComparison;
};

/**
 * Logical AND condition supporting an array of PredicateJSON objects
 */
export type AndCondition<T> = { $and: PredicateJSON<T>[] };

/**
 * Logical OR condition supporting an array of PredicateJSON objects
 */
export type OrCondition<T> = { $or: PredicateJSON<T>[] };

/**
 * The root predicate type which can be:
 * - a set of field filters recursively defined,
 * - or a logical AND condition,
 * - or a logical OR condition.
 */
export type PredicateJSON<T> =
  | Fields<T>
  | AndCondition<T>
  | OrCondition<T>;
