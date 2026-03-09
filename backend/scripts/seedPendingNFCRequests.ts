/**
 * Seed script to create pending NFC tag requests for testing
 * Usage: ts-node backend/scripts/seedPendingNFCRequests.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PetTagRequest from '../src/models/PetTagRequest';
import Pet from '../src/models/Pet';
import User from '../src/models/User';
import Clinic from '../src/models/Clinic';

dotenv.config();

const seedPendingRequests = async () => {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Get or create a clinic
    let clinic = await Clinic.findOne({ isActive: true });
    if (!clinic) {
      console.log('Creating a test clinic...');
      clinic = new Clinic({
        name: 'Test Clinic',
        address: '123 Main St',
        contactNumber: '555-0001',
        email: 'test@clinic.com',
        isActive: true,
      });
      await clinic.save();
      console.log('✓ Created test clinic');
    }

    // Get an existing pet owner (or create one)
    let petOwner = await User.findOne({ userType: 'pet-owner' });
    if (!petOwner) {
      console.log('Creating a test pet owner...');
      petOwner = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: `pet-owner-${Date.now()}@example.com`,
        password: 'hashedpassword', // In real scenario, this would be hashed
        userType: 'pet-owner',
        isVerified: true,
        emailVerified: true,
      });
      await petOwner.save();
      console.log('✓ Created test pet owner');
    }

    // Get some existing pets or create test pets
    let pets = await Pet.find({ ownerId: petOwner._id }).limit(5);
    
    if (pets.length === 0) {
      console.log('Creating test pets...');
      const testPets = [
        {
          name: 'Max',
          species: 'dog' as 'dog' | 'cat',
          breed: 'Golden Retriever',
          ownerId: petOwner._id,
          dateOfBirth: new Date('2020-01-15'),
          color: 'Golden',
          weight: 65,
          clinicId: clinic._id,
        },
        {
          name: 'Luna',
          species: 'cat' as 'dog' | 'cat',
          breed: 'Siamese',
          ownerId: petOwner._id,
          dateOfBirth: new Date('2019-06-20'),
          color: 'Cream',
          weight: 8,
          clinicId: clinic._id,
        },
        {
          name: 'Charlie',
          species: 'dog' as 'dog' | 'cat',
          breed: 'Labrador',
          ownerId: petOwner._id,
          dateOfBirth: new Date('2021-03-10'),
          color: 'Black',
          weight: 70,
          clinicId: clinic._id,
        },
      ];

      const createdPets = await Pet.insertMany(testPets);
      pets = createdPets as any;
      console.log(`✓ Created ${pets.length} test pets`);
    }

    // Clear existing pending requests for these pets
    await PetTagRequest.deleteMany({
      petId: { $in: pets.map(p => p._id) },
      status: 'pending'
    });
    console.log('✓ Cleared existing pending requests');

    // Create pending tag requests for the pets
    console.log('Creating pending NFC tag requests...');
    const pendingRequests = pets.map(pet => ({
      petId: pet._id,
      ownerId: petOwner._id,
      clinicId: clinic._id,
      reason: ['lost_replacement', 'upgrade', 'additional'][Math.floor(Math.random() * 3)],
      status: 'pending',
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      clinicBranchId: null,
    }));

    const created = await PetTagRequest.insertMany(pendingRequests);
    console.log(`✓ Created ${created.length} pending NFC tag requests`);

    // Display created requests
    console.log('\nCreated pending requests:');
    const requests = await PetTagRequest.find({
      status: 'pending',
      petId: { $in: pets.map(p => p._id) }
    })
      .populate('petId', 'name species breed')
      .populate('ownerId', 'firstName lastName email');

    requests.forEach(req => {
      console.log(`  - ${(req.petId as any).name} (${(req.ownerId as any).firstName} ${(req.ownerId as any).lastName})`);
    });

    console.log('\n✓ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seedPendingRequests();
