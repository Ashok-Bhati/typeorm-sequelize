import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../entity';
import { Column } from '../../decorators';

@Entity('test_entities')
export class TestEntity extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  createdAt!: Date;

  constructor(name: string, description?: string) {
    super();
    this.name = name;
    this.description = description;
    this.createdAt = new Date();
  }
} 
