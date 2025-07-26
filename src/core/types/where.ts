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
  | '$notILike'

export type FieldComparison = {
  [op in Operator]?: string | number | boolean | null | (string | number)[];
};

type FieldConditions<T> = {
  [K in keyof T as T[K] extends Function ? never : K]?: FieldComparison;
};

type LogicalCondition<T> = {
  $and?: PredicateJSON<T>[];
  $or?: PredicateJSON<T>[];
};

export type PredicateJSON<T> = FieldConditions<T> | LogicalCondition<T>;
