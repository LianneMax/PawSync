import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function check() {
  try {
    await mongoose.connect(MONGO_URL)
    
    // Check specific ID from the error
    const id = '69b049a3806791e5b4b1328f'
    console.log(`Looking for service with _id: ${id}`)
    
    const service = await ProductService.findById(id)
    if (service) {
      console.log('Found:')
      console.log(`  Name: ${service.name}`)
      console.log(`  intervalDays: ${service.intervalDays}`)
      console.log(`  Full: `, JSON.stringify(service.toObject(), null, 2))
    } else {
      console.log('Not found')
    }
    
    // List all and their IDs
    console.log('\n=== All Preventive Care Services ===')
    const all = await ProductService.find({ category: 'Preventive Care' })
    all.forEach(s => {
      console.log(`[${s._id}] ${s.name} - intervalDays: ${s.intervalDays}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

check()
