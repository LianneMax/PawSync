import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function updateServices() {
  try {
    await mongoose.connect(MONGO_URL)
    console.log('✓ Connected to MongoDB')

    // Update Flea and Tick Prevention to 30 days
    const result = await ProductService.updateOne(
      { name: 'Flea and Tick Prevention' },
      { $set: { intervalDays: 30, description: 'Monthly flea and tick prevention treatment' } }
    )

    if (result.modifiedCount > 0) {
      console.log('✓ Updated "Flea and Tick Prevention" to 30-day interval')
    } else {
      console.log('✗ No service found to update')
    }

    // Verify
    const service = await ProductService.findOne({ name: 'Flea and Tick Prevention' })
    console.log(`\nVerification: Flea and Tick Prevention = ${service?.intervalDays} days`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

updateServices()
