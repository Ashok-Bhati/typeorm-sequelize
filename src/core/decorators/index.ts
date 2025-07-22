import { Entity as TypeORMEntity, Column as TypeORMColumn, PrimaryGeneratedColumn as TypeORMPrimaryGeneratedColumn } from 'typeorm';

/**
 * Enhanced Entity decorator with additional tracking capabilities
 */
export const Entity = TypeORMEntity;

/**
 * Enhanced Column decorator with additional validation
 */
export const Column = TypeORMColumn; 

export const PrimaryGeneratedColumn = TypeORMPrimaryGeneratedColumn;
