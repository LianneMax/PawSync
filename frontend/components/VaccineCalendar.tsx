'use client'

import { useState, useEffect } from 'react'
import { Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Calendar as UiCalendar } from '@/components/ui/calendar'
import { format, isPast, isSameDay, isToday } from 'date-fns'
import type { UpcomingVaccine, VetUpcomingSchedule, ClinicUpcomingSchedule } from '@/lib/vaccinations'

interface VaccineCalendarProps {
  upcomingVaccines: UpcomingVaccine[] | VetUpcomingSchedule[] | ClinicUpcomingSchedule[];
  title?: string;
  subtitle?: string;
  isVetView?: boolean;
  isClinicView?: boolean;
  onDateSelect?: (date: Date) => void;
}

export default function VaccineCalendar({
  upcomingVaccines,
  title = 'Vaccine Schedule',
  subtitle = 'Upcoming vaccine appointments',
  isVetView = false,
  isClinicView = false,
  onDateSelect,
}: VaccineCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  });
  const [calendarMarkers, setCalendarMarkers] = useState<Date[]>([]);

  // Generate calendar markers for dates with vaccines
  useEffect(() => {
    const markers = upcomingVaccines.map((v) => {
      const date = new Date(v.nextDueDate);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    });
    setCalendarMarkers(markers);
  }, [upcomingVaccines]);

  // Get vaccines for the selected date
  const selectedDateVaccines = selectedDate
    ? upcomingVaccines.filter((v) => {
        const vaccineDate = new Date(v.nextDueDate);
        return isSameDay(vaccineDate, selectedDate);
      })
    : [];

  // Custom modifiers for styling
  const modifiers = {
    vaccineDay: calendarMarkers,
    selected: selectedDate ? [selectedDate] : [],
  };

  const modifiersClassNames = {
    vaccineDay: 'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-[#35785C] after:rounded-full hover:bg-[#F0F7F7]',
    today: 'bg-[#E8F5F3] font-semibold text-[#35785C]',
    selected: 'bg-[#35785C] text-white font-semibold rounded-lg',
  };

  const getPetName = (vaccine: UpcomingVaccine | VetUpcomingSchedule | ClinicUpcomingSchedule) => {
    if ('pet' in vaccine) {
      return vaccine.pet.name;
    }
    return 'Pet';
  };

  const getVetName = (vaccine: VetUpcomingSchedule | ClinicUpcomingSchedule) => {
    if ('vet' in vaccine) {
      return vaccine.vet.name;
    }
    return '';
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyColor = (daysUntilDue: number) => {
    if (daysUntilDue <= 7) return 'text-red-600 bg-red-50 border-red-200';
    if (daysUntilDue <= 14) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (daysUntilDue <= 30) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-linear-to-r from-[#F8F6F2] to-white">
        <div className="flex items-center gap-3 mb-1">
          <Calendar className="w-5 h-5 text-[#35785C]" />
          <h2 className="text-lg font-bold text-[#4F4F4F]">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-gray-500 ml-8">{subtitle}</p>}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <UiCalendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              onDateSelect?.(date!);
            }}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            disabled={(date) => {
              // Disable past dates
              return isPast(date) && !isToday(date);
            }}
            footer={
              upcomingVaccines.length > 0
                ? `${upcomingVaccines.length} upcoming vaccine${upcomingVaccines.length !== 1 ? 's' : ''}`
                : 'No upcoming vaccines scheduled'
            }
            className="rounded-xl border border-gray-200 bg-white p-3 [&_.rdp]:m-0 [&_.rdp-head_cell]:text-xs [&_.rdp-cell]:p-0 [&_.rdp-day]:rounded-lg"
          />
        </div>

        {/* Upcoming Vaccines List */}
        <div className="lg:col-span-2 space-y-3 max-h-96 overflow-y-auto">
          {selectedDateVaccines.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded-full bg-[#35785C]" />
                <p className="text-sm font-semibold text-[#4F4F4F]">
                  {format(selectedDate!, 'MMMM d, yyyy')}
                </p>
              </div>
              {selectedDateVaccines.map((vaccine) => {
                const daysUntil = getDaysUntilDue(vaccine.nextDueDate);
                const isExpiring = 'dateType' in vaccine && vaccine.dateType === 'expires';
                const typeLabel = isExpiring ? 'Expires' : 'Booster Due';
                return (
                  <div
                    key={vaccine._id}
                    className={`p-4 rounded-xl border-2 ${getUrgencyColor(daysUntil)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-[#4F4F4F]">
                          {vaccine.vaccineName}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {typeLabel}
                          {vaccine.vaccineType && 'doseNumber' in vaccine && (vaccine as UpcomingVaccine).doseNumber > 1 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold text-gray-600">
                              {vaccine.vaccineType.isSeries && (vaccine as UpcomingVaccine).doseNumber <= vaccine.vaccineType.totalSeries
                                ? `Series ${(vaccine as UpcomingVaccine).doseNumber}/${vaccine.vaccineType.totalSeries}`
                                : `Booster #${(vaccine as UpcomingVaccine).doseNumber - (vaccine.vaccineType.isSeries ? vaccine.vaccineType.totalSeries : 1)}`}
                            </span>
                          )}
                        </p>
                        {isVetView || isClinicView ? (
                          <p className="text-xs text-gray-600 mt-1">
                            Pet: {getPetName(vaccine)}
                          </p>
                        ) : null}
                        {isClinicView ? (
                          <p className="text-xs text-gray-600">
                            Vet: {getVetName(vaccine as VetUpcomingSchedule | ClinicUpcomingSchedule)}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        {daysUntil <= 7 ? (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        {daysUntil <= 0 ? (
                          <span className="text-red-600 font-semibold">{isExpiring ? 'Already Expired' : 'Overdue'}</span>
                        ) : (
                          <span>
                            {daysUntil === 1 ? `${typeLabel} tomorrow` : `${typeLabel} in ${daysUntil} days`}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-500">
                        Last: {vaccine.lastAdministeredDate
                          ? format(new Date(vaccine.lastAdministeredDate), 'MMM d, yyyy')
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
              <p className="text-gray-500 font-medium">No vaccines due on this date</p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedDate && !isToday(selectedDate)
                  ? 'Select another date to view scheduled vaccines'
                  : 'All vaccines are up to date'}
              </p>
            </div>
          )}

          {/* Upcoming vaccines summary if not showing calendar selection */}
          {!selectedDate && upcomingVaccines.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Next 5 Due
              </p>
              <div className="space-y-2">
                {upcomingVaccines.slice(0, 5).map((vaccine) => {
                  const daysUntil = getDaysUntilDue(vaccine.nextDueDate);
                  const isExpiring = 'dateType' in vaccine && vaccine.dateType === 'expires';
                  const typeLabel = isExpiring ? 'Exp.' : 'Due';
                  return (
                    <div
                      key={vaccine._id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#4F4F4F] truncate">
                          {vaccine.vaccineName}
                        </p>
                        {isVetView || isClinicView ? (
                          <p className="text-[10px] text-gray-500">
                            {getPetName(vaccine)}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-[10px] font-semibold text-gray-600">
                          {format(new Date(vaccine.nextDueDate), 'MMM d')}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {daysUntil <= 0 ? (isExpiring ? 'Expired' : 'Overdue') : `${daysUntil}d ${typeLabel}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Summary */}
      {upcomingVaccines.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#35785C]">
              {upcomingVaccines.length}
            </p>
            <p className="text-xs text-gray-600">Total Due</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {upcomingVaccines.filter((v) => getDaysUntilDue(v.nextDueDate) <= 7).length}
            </p>
            <p className="text-xs text-gray-600">Within 7 Days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {upcomingVaccines.filter((v) => getDaysUntilDue(v.nextDueDate) > 30).length}
            </p>
            <p className="text-xs text-gray-600">Over 30 Days</p>
          </div>
        </div>
      )}
    </div>
  );
}
