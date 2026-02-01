'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'

export default function MySchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 2)) // Feb 2, 2026

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const days = []
  const firstDay = firstDayOfMonth(currentDate)
  const daysCount = daysInMonth(currentDate)

  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysCount; i++) {
    days.push(i)
  }

  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Schedule</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">{monthName}</h2>
              <div className="flex gap-2">
                <button
                  onClick={previousMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-semibold text-gray-600 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium ${
                    day === null
                      ? 'bg-gray-50'
                      : day === 2
                        ? 'bg-[#7FA5A3] text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Upcoming
            </h2>

            <div className="space-y-4">
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No scheduled appointments</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Working Hours</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Monday - Friday:</span>
                  <span className="font-medium">9:00 AM - 5:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday:</span>
                  <span className="font-medium">10:00 AM - 3:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday:</span>
                  <span className="font-medium">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Today's Schedule</h2>
          <div className="space-y-3">
            {Array.from({ length: 8 }, (_, i) => {
              const hour = 9 + i
              const period = hour >= 12 ? 'PM' : 'AM'
              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
              return (
                <div key={i} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-b-0">
                  <div className="text-sm font-semibold text-gray-600 w-20">
                    {displayHour}:00 {period}
                  </div>
                  <div className="flex-1 py-2 px-4 bg-gray-50 rounded-lg text-sm text-gray-500 text-center">
                    Available
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
