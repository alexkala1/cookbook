import { defineEventHandler } from 'h3'
import { pantryChefAdvice } from '../../utils/chef-advice'
export default defineEventHandler(event => pantryChefAdvice(event))
