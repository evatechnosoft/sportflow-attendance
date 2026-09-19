import { runDataSourceContract } from '../../testing/dataSourceContract'
import { createMockDataSource } from './mockDataSource'

runDataSourceContract('MockDataSource', () => createMockDataSource())
