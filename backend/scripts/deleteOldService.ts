import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function fix() {
  try {
    await mongoose.connect(MONGO_URL)
    
    const targetId = '69b049a3806791e5b4b1328f'
    console.log(`\nLooking for service with _id: ${targetId}`)
    
    const service = await ProductService.findById(targetId)
    if (service) {
      console.log(`Found: "${service.name}" | intervalDays: ${service.intervalDays}`)
      console.log('DELETING...')
      await ProductService.deleteOne({ _id: targetId })
      console.log('✓ DELETED')
    } else {
      console.log('Not found in database')
    }
    
    console.log('\n=== FINAL STATE - ALL PREVENTIVE CARE SERVICES ===')
    const all = await ProductService.find({ category: 'Preventive Care' }).sort({ name: 1 })
    console.log(`Total: ${all.length}`)
    all.forEach(s => {
      console.log(`- _id: ${s._id}`)
      console.log(`  Name: "${s.name}"`)
      console.log(`  intervalDays: ${s.intervalDays}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

fix()
