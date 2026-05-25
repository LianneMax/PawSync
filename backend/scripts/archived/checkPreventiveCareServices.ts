import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function checkServices() {
  try {
    await mongoose.connect(MONGO_URL)
    
    console.log('\n=== ALL ACTIVE SERVICES ===')
    const allServices = await ProductService.find({ isActive: true }).sort({ type: 1, name: 1 })
    allServices.forEach((s) => {
      console.log(`Name: "${s.name}" | Category: "${s.category}" | IntervalDays: ${s.intervalDays || 'N/A'}`)
    })
    
    console.log('\n=== PREVENTIVE CARE SERVICES ===')
    const prevServices = await ProductService.find({ category: 'Preventive Care', isActive: true })
    prevServices.forEach((s) => {
      console.log(`Name: "${s.name}" | Interval Days: ${s.intervalDays}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

checkServices()
