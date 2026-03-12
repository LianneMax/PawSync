import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function checkAll() {
  try {
    await mongoose.connect(MONGO_URL)
    
    console.log('\n=== ALL PREVENTIVE CARE SERVICES ===')
    const services = await ProductService.find({ category: 'Preventive Care' })
    services.forEach((s, i) => {
      console.log(`\n[${i}] Name: "${s.name}"`)
      console.log(`    _id: ${s._id}`)
      console.log(`    intervalDays: ${s.intervalDays}`)
      console.log(`    isActive: ${s.isActive}`)
    })
    
    console.log('\n=== UPDATING ALL to ensure intervalDays is set ===')
    
    // Force update Deworming
    await ProductService.updateOne(
      { name: 'Deworming' },
      { $set: { intervalDays: 90 } }
    )
    console.log('✓ Updated Deworming to 90 days')
    
    // Force update Flea and Tick Prevention - try both names
    let result = await ProductService.updateOne(
      { name: 'Flea & Tick Prevention' },
      { $set: { intervalDays: 30 } }
    )
    if (result.modifiedCount > 0) {
      console.log('✓ Updated "Flea & Tick Prevention" to 30 days')
    }
    
    result = await ProductService.updateOne(
      { name: 'Flea and Tick Prevention' },
      { $set: { intervalDays: 30 } }
    )
    if (result.modifiedCount > 0) {
      console.log('✓ Updated "Flea and Tick Prevention" to 30 days')
    }
    
    // Verify
    console.log('\n=== VERIFICATION ===')
    const updated = await ProductService.find({ category: 'Preventive Care' }).sort({ name: 1 })
    updated.forEach((s) => {
      console.log(`${s.name}: ${s.intervalDays} days`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

checkAll()
