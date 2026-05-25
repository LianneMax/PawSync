import mongoose from 'mongoose'
import ProductService from '../src/models/ProductService'

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawsync'

async function fix() {
  try {
    await mongoose.connect(MONGO_URL)
    
    console.log('\n=== FINDING ALL SERVICES ===')
    const all = await ProductService.find({})
    console.log(`Total services: ${all.length}`)
    
    all.forEach(s => {
      console.log(`- "${s.name}" | ${s.category} | intervalDays: ${s.intervalDays}`)
    })
    
    console.log('\n=== LOOKING FOR DUPLICATES ===')
    const fleas = await ProductService.find({ name: { $regex: 'Flea', $options: 'i' } })
    console.log(`Found ${fleas.length} services with "Flea":`)
    fleas.forEach(s => {
      console.log(`  "${s.name}" (_id: ${s._id}) | intervalDays: ${s.intervalDays}`)
    })
    
    if (fleas.length > 1) {
      console.log('\n=== DELETING DUPLICATES, KEEPING ONLY ONE ===')
      // Delete all except the first one
      const toKeep = fleas[0]
      console.log(`Keeping: "${toKeep.name}"`)
      
      for (let i = 1; i < fleas.length; i++) {
        const s = fleas[i]
        await ProductService.deleteOne({ _id: s._id })
        console.log(`✓ Deleted: "${s.name}" (_id: ${s._id})`)
      }
    }
    
    console.log('\n=== UPDATING INTERVALS ===')
    // Ensure Deworming has 90 days
    await ProductService.updateOne(
      { name: 'Deworming' },
      { $set: { intervalDays: 90 } }
    )
    console.log('✓ Deworming: 90 days')
    
    // Find Flea service (whatever the name is) and set to 30 days
    const fleaService = await ProductService.findOne({ name: { $regex: 'Flea', $options: 'i' } })
    if (fleaService) {
      await ProductService.updateOne(
        { _id: fleaService._id },
        { $set: { intervalDays: 30 } }
      )
      console.log(`✓ "${fleaService.name}": 30 days`)
    }
    
    console.log('\n=== FINAL CHECK ===')
    const final = await ProductService.find({ category: 'Preventive Care' }).sort({ name: 1 })
    final.forEach(s => {
      console.log(`- "${s.name}" | intervalDays: ${s.intervalDays}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
  }
}

fix()
