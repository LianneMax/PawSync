import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function check() {
  try {
    await mongoose.connect(MONGO_URL)
    
    console.log('\n=== ALL ACTIVE SERVICES ===')
    const active = await ProductService.find({ isActive: true }).sort({ category: 1, name: 1 })
    console.log(`Total: ${active.length}`)
    active.forEach(s => {
      console.log(`- "${s.name}" | ${s.category} | intervalDays: ${s.intervalDays}`)
    })
    
    console.log('\n=== ALL SERVICES BY CATEGORY ===')
    const byCategory = await ProductService.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ])
    byCategory.forEach(cat => {
      console.log(`${cat._id}: ${cat.count}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

check()
