import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function check() {
  try {
    await mongoose.connect(MONGO_URL)
    
    console.log('=== SEARCHING FOR ALL FLEA SERVICES ===')
    const flea = await ProductService.find({ name: { $regex: 'Flea', $options: 'i' } })
    console.log(`Found ${flea.length} services:`)
    flea.forEach(s => {
      console.log(`- "${s.name}" - intervalDays: ${s.intervalDays} - isActive: ${s.isActive}`)
    })
    
    if (flea.length > 1) {
      console.log('\nDELETING DUPLICATES...')
      // Keep only one
      const toDelete = flea.slice(1)
      for (const service of toDelete) {
        await ProductService.deleteOne({ _id: service._id })
        console.log(`Deleted: "${service.name}" (_id: ${service._id})`)
      }
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

check()
