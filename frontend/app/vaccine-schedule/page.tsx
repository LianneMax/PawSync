'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import VaccineCalendar from '@/components/VaccineCalendar'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'
import { getUpcomingVaccineDates, type UpcomingVaccine } from '@/lib/vaccinations'
import { Calendar, AlertCircle, CheckCircle, PawPrint } from 'lucide-react'
import { toast } from 'sonner'

export default function VaccineSchedulePage() {
  const { token } = useAuthStore()
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string>('')
  const [upcomingVaccines, setUpcomingVaccines] = useState<UpcomingVaccine[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch pets on mount
  useEffect(() => {
    async function fetchPets() {
      if (!token) return
      try {
        const data = await getMyPets(token)
        setPets(data)
        if (data.length > 0) {
          setSelectedPetId(data[0]._id)
        }
      } catch (error) {
        console.error('Error fetching pets:', error)
        toast.error('Failed to load pets')
      }
    }
    fetchPets()
  }, [token])

  // Fetch upcoming vaccines when pet changes
  useEffect(() => {
    async function fetchUpcomingVaccines() {
      if (!token || !selectedPetId) {
        setUpcomingVaccines([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await getUpcomingVaccineDates(selectedPetId, token)
        setUpcomingVaccines(data)
      } catch (error) {
        console.error('Error fetching upcoming vaccines:', error)
        setUpcomingVaccines([])
        toast.error('Failed to load upcoming vaccines')
      } finally {
        setLoading(false)
      }
    }

    fetchUpcomingVaccines()
  }, [selectedPetId, token])

  const selectedPet = pets.find((p) => p._id === selectedPetId)

  // Calculate summary statistics
  const overduevaccines = upcomingVaccines.filter((v) => {
    const daysUntil = Math.ceil(
      (new Date(v.nextDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntil <= 0;
  });

  const urgentVaccines = upcomingVaccines.filter((v) => {
    const daysUntil = Math.ceil(
      (new Date(v.nextDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntil > 0 && daysUntil <= 7;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-[#35785C]" />
            <h1 className="text-3xl font-bold text-[#4F4F4F]">Vaccine Schedule</h1>
          </div>
          <p className="text-gray-600">Track and manage your pets' upcoming vaccine appointments</p>
        </div>

        {/* Pet Selection */}
        {pets.length > 0 ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-[#4F4F4F] mb-3 uppercase tracking-wide">
                Select Pet
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pets.map((pet) => (
                  <button
                    key={pet._id}
                    onClick={() => setSelectedPetId(pet._id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedPetId === pet._id
                        ? 'border-[#35785C] bg-[#E8F5F3]'
                        : 'border-gray-200 bg-white hover:border-[#7FA5A3]'
                    }`}
                  >
                    {pet.photo ? (
                      <img
                        src={pet.photo}
                        alt={pet.name}
                        className="w-12 h-12 rounded-lg object-cover mx-auto mb-2"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#7FA5A3] to-[#5A7C7A] flex items-center justify-center mx-auto mb-2">
                        <PawPrint className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <p className="text-sm font-semibold text-[#4F4F4F] truncate">{pet.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{pet.species}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            {selectedPet && upcomingVaccines.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Scheduled</p>
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{upcomingVaccines.length}</p>
                  <p className="text-xs text-blue-600 mt-1">upcoming vaccine{upcomingVaccines.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Urgent</p>
                  </div>
                  <p className="text-3xl font-bold text-red-700">
                    {overduevaccines.length + urgentVaccines.length}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {overduevaccines.length > 0 ? `${overduevaccines.length} overdue` : ''}
                    {overduevaccines.length > 0 && urgentVaccines.length > 0 ? ', ' : ''}
                    {urgentVaccines.length > 0 ? `${urgentVaccines.length} due within 7 days` : ''}
                    {overduevaccines.length === 0 && urgentVaccines.length === 0 ? 'No urgent vaccines' : ''}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Later</p>
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    {upcomingVaccines.filter((v) => {
                      const daysUntil = Math.ceil(
                        (new Date(v.nextDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return daysUntil > 30;
                    }).length}
                  </p>
                  <p className="text-xs text-green-600 mt-1">scheduled for 30+ days</p>
                </div>
              </div>
            )}

            {/* Calendar */}
            {selectedPet && (
              <div>
                {loading ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                    <div className="animate-pulse flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                      <p className="text-gray-400">Loading vaccine schedule...</p>
                    </div>
                  </div>
                ) : upcomingVaccines.length > 0 ? (
                  <VaccineCalendar
                    upcomingVaccines={upcomingVaccines}
                    title={`${selectedPet.name}'s Vaccine Schedule`}
                    subtitle={`${selectedPet.breed} • ${selectedPet.species}`}
                  />
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">{selectedPet.name} is all caught up!</h3>
                    <p className="text-gray-600">No upcoming vaccines are currently scheduled.</p>
                    <p className="text-sm text-gray-500 mt-2">New vaccines will appear here as they are scheduled by your veterinarian.</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <p className="text-gray-400">Loading pets...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">No pets found</h3>
            <p className="text-gray-600">You haven't added any pets yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
