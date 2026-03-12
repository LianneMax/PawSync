import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function cleanup() {
  try {
    await mongoose.connect(MONGO_URL)
    
    console.log('\n=== FINDING SERVICES WITH NULL intervalDays ===')
    const nullIntervalServices = await ProductService.find({ intervalDays: null, category: 'Preventive Care' })
    console.log(`Found ${nullIntervalServices.length} services with null intervalDays:`)
    nullIntervalServices.forEach(s => {
      console.log(`- "${s.name}" (_id: ${s._id})`)
    })
    
    if (nullIntervalServices.length > 0) {
      console.log('\nDELETING old services with null intervalDays...')
      for (const service of nullIntervalServices) {
        await ProductService.deleteOne({ _id: service._id })
        console.log(`✓ Deleted: "${service.name}"`)
      }
    }
    
    console.log('\n=== ALL REMAINING PREVENTIVE CARE SERVICES ===')
    const remaining = await ProductService.find({ category: 'Preventive Care' })
    console.log(`Total: ${remaining.length}`)
    remaining.forEach(s => {
      console.log(`- "${s.name}" | intervalDays: ${s.intervalDays}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

cleanup()
