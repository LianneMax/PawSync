'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import VaccineCalendar from '@/components/VaccineCalendar'
import { useAuthStore } from '@/store/authStore'
import { getClinicUpcomingSchedule, type ClinicUpcomingSchedule } from '@/lib/vaccinations'
import { Calendar, AlertCircle, CheckCircle, Users, Syringe, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function ClinicVaccineSchedulePage() {
  const { token, user } = useAuthStore()
  const [upcomingSchedule, setUpcomingSchedule] = useState<ClinicUpcomingSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'urgent' | 'upcoming'>('all')
  const [filterVet, setFilterVet] = useState<string>('all')

  // Fetch upcoming schedule on mount
  useEffect(() => {
    async function fetchSchedule() {
      if (!token || !user?.clinicId) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await getClinicUpcomingSchedule(user.clinicId, token)
        setUpcomingSchedule(data)
      } catch (error) {
        console.error('Error fetching schedule:', error)
        setUpcomingSchedule([])
        toast.error('Failed to load vaccine schedule')
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()
  }, [token, user?.clinicId])

  // Helper to get days until due
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  };

  const overdueVaccines = upcomingSchedule.filter((v) => getDaysUntilDue(v.nextDueDate) <= 0);
  const urgentVaccines = upcomingSchedule.filter((v) => {
    const days = getDaysUntilDue(v.nextDueDate);
    return days > 0 && days <= 7;
  });
  const upcomingVaccines = upcomingSchedule.filter((v) => getDaysUntilDue(v.nextDueDate) > 7);

  // Get unique vets
  const uniqueVets = Array.from(new Set(upcomingSchedule.map((v) => v.vet._id))).map((id) => {
    const vet = upcomingSchedule.find((v) => v.vet._id === id)!.vet;
    return vet;
  });

  // Filter schedule based on status and vet
  let filteredSchedule = upcomingSchedule;

  if (filterStatus === 'urgent') {
    filteredSchedule = [...overdueVaccines, ...urgentVaccines];
  } else if (filterStatus === 'upcoming') {
    filteredSchedule = upcomingVaccines;
  }

  if (filterVet !== 'all') {
    filteredSchedule = filteredSchedule.filter((v) => v.vet._id === filterVet);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-6 h-6 text-[#35785C]" />
            <h1 className="text-3xl font-bold text-[#4F4F4F]">Clinic Vaccine Schedule</h1>
          </div>
          <p className="text-gray-600">Track all upcoming vaccine appointments across your clinic</p>
        </div>

        {/* Summary Cards */}
        {!loading && upcomingSchedule.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <Syringe className="w-5 h-5 text-blue-600" />
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Due</p>
              </div>
              <p className="text-3xl font-bold text-blue-700">{upcomingSchedule.length}</p>
              <p className="text-xs text-blue-600 mt-1">vaccine{upcomingSchedule.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="bg-linear-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Overdue</p>
              </div>
              <p className="text-3xl font-bold text-red-700">{overdueVaccines.length}</p>
              <p className="text-xs text-red-600 mt-1">need immediate attention</p>
            </div>

            <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">This Week</p>
              </div>
              <p className="text-3xl font-bold text-orange-700">{urgentVaccines.length}</p>
              <p className="text-xs text-orange-600 mt-1">due within 7 days</p>
            </div>

            <div className="bg-linear-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-green-600" />
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Vets</p>
              </div>
              <p className="text-3xl font-bold text-green-700">{uniqueVets.length}</p>
              <p className="text-xs text-green-600 mt-1">managing patients</p>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        {!loading && upcomingSchedule.length > 0 && (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-[#35785C] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-[#35785C]'
                }`}
              >
                All ({upcomingSchedule.length})
              </button>
              <button
                onClick={() => setFilterStatus('urgent')}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  filterStatus === 'urgent'
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300'
                }`}
              >
                Urgent ({overdueVaccines.length + urgentVaccines.length})
              </button>
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  filterStatus === 'upcoming'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                Later ({upcomingVaccines.length})
              </button>
            </div>

            {uniqueVets.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-left min-w-[220px]"
                  >
                    {filterVet === 'all'
                      ? 'All Veterinarians'
                      : uniqueVets.find((vet) => vet._id === filterVet)?.name || 'All Veterinarians'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-xl max-h-60 overflow-y-auto">
                  <DropdownMenuRadioGroup value={filterVet} onValueChange={setFilterVet}>
                    <DropdownMenuRadioItem value="all">All Veterinarians</DropdownMenuRadioItem>
                    {uniqueVets.map((vet) => (
                      <DropdownMenuRadioItem key={vet._id} value={vet._id}>{vet.name}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Calendar View */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <p className="text-gray-400">Loading vaccine schedule...</p>
            </div>
          </div>
        ) : upcomingSchedule.length > 0 ? (
          <VaccineCalendar
            upcomingVaccines={filteredSchedule}
            title="Your Clinic's Vaccine Schedule"
            subtitle={`${filteredSchedule.length} appointment${filteredSchedule.length !== 1 ? 's' : ''} scheduled`}
            isClinicView={true}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">All vaccines are up to date!</h3>
            <p className="text-gray-600">No upcoming vaccines need to be scheduled for your clinic.</p>
          </div>
        )}

        {/* Detailed Table View */}
        {!loading && filteredSchedule.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-linear-to-r from-[#F8F6F2] to-white">
              <h2 className="text-lg font-bold text-[#4F4F4F]">Detailed List</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Patient</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Vaccine</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Type</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Veterinarian</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Due Date</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSchedule.map((vaccine) => {
                    const daysUntil = getDaysUntilDue(vaccine.nextDueDate);
                    const statusColor =
                      daysUntil <= 0
                        ? 'bg-red-50 text-red-700'
                        : daysUntil <= 7
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-blue-50 text-blue-700';
                    return (
                      <tr key={vaccine._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {vaccine.pet.photo ? (
                              <Image
                                src={vaccine.pet.photo}
                                alt={vaccine.pet.name}
                                width={32}
                                height={32}
                                className="rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-[#7FA5A3]/20 flex items-center justify-center">
                                <Syringe className="w-4 h-4 text-[#476B6B]" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-[#4F4F4F]">{vaccine.pet.name}</p>
                              <p className="text-xs text-gray-500 capitalize">{vaccine.pet.species}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-[#4F4F4F]">{vaccine.vaccineName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                            {'dateType' in vaccine && vaccine.dateType === 'expires' ? 'Expires' : 'Booster Due'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[#4F4F4F]">{vaccine.vet.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-[#4F4F4F]">
                            {new Date(vaccine.nextDueDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                            {daysUntil <= 0 
                              ? ('dateType' in vaccine && vaccine.dateType === 'expires' ? 'Already Expired' : 'Overdue')
                              : daysUntil <= 7 ? 'This Week' : `${daysUntil}d away`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
