import React from 'react'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Module mocks (hoisted) ─────────────────────────────────────────────────────

vi.mock('@/store/authStore', () => ({ useAuthStore: vi.fn() }))

vi.mock('@/lib/medicalRecords', () => ({
  getSurgeryServices: vi.fn(),
  createMedicalRecord: vi.fn(),
}))

vi.mock('@/lib/upload', () => ({ uploadImage: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/components/ui/dialog', () => {
  const R = require('react')
  return {
    Dialog: ({ children, open }: any) =>
      open ? R.createElement('div', { 'data-testid': 'dialog' }, children) : null,
    DialogContent: ({ children }: any) =>
      R.createElement('div', { 'data-testid': 'dialog-content' }, children),
    DialogHeader: ({ children }: any) => R.createElement('div', null, children),
    DialogTitle: ({ children }: any) => R.createElement('div', null, children),
    DialogFooter: ({ children }: any) =>
      R.createElement('div', { 'data-testid': 'dialog-footer' }, children),
  }
})

vi.mock('@/components/ui/dropdown-menu', () => {
  const R = require('react')
  return {
    DropdownMenu: ({ children }: any) => R.createElement(R.Fragment, null, children),
    DropdownMenuTrigger: ({ children }: any) => R.createElement(R.Fragment, null, children),
    DropdownMenuContent: ({ children }: any) =>
      R.createElement('div', { 'data-testid': 'dropdown-content' }, children),
    DropdownMenuRadioGroup: ({ children, onValueChange, value }: any) =>
      R.createElement(
        'div',
        { 'data-testid': 'radio-group', 'data-value': value },
        R.Children.map(children, (child: any) =>
          R.isValidElement(child)
            ? R.cloneElement(child as R.ReactElement<any>, { _onChange: onValueChange })
            : child,
        ),
      ),
    DropdownMenuRadioItem: ({ children, value, _onChange }: any) =>
      R.createElement(
        'button',
        { role: 'radio', 'data-value': value, onClick: () => _onChange?.(value) },
        children,
      ),
  }
})

// ── Imports ────────────────────────────────────────────────────────────────────

import { useAuthStore } from '@/store/authStore'
import { getSurgeryServices, createMedicalRecord } from '@/lib/medicalRecords'
import { uploadImage } from '@/lib/upload'
import { toast } from 'sonner'
import SurgeryMedicalRecordModal from './SurgeryMedicalRecordModal'

const mockUseAuthStore = vi.mocked(useAuthStore)
const mockGetSurgeryServices = vi.mocked(getSurgeryServices)
const mockCreateMedicalRecord = vi.mocked(createMedicalRecord)
const mockUploadImage = vi.mocked(uploadImage)

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SURGERY_SERVICES = [
  { _id: 'surg-001', name: 'Spay', price: 3500, type: 'Service', category: 'Surgeries' },
  { _id: 'surg-002', name: 'Neuter', price: 2500, type: 'Service', category: 'Surgeries' },
]

function mockAuth(userType = 'vet', token = 'test-token') {
  return (selector: (s: any) => any) => selector({ token, user: { userType } })
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  appointmentId: 'appt-001',
  petId: 'pet-001',
  petName: 'Buddy',
  onSaved: vi.fn(),
}

// Flush React 18 async state updates queued after microtasks
const flush = () => act(async () => {})

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockUseAuthStore.mockImplementation(mockAuth())
  mockGetSurgeryServices.mockResolvedValue({
    status: 'SUCCESS',
    data: { items: SURGERY_SERVICES },
  } as any)
  mockCreateMedicalRecord.mockResolvedValue({
    status: 'SUCCESS',
    data: { record: { _id: 'rec-001' } },
  } as any)
  mockUploadImage.mockResolvedValue('https://cdn.example.com/img.jpg')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SurgeryMedicalRecordModal', () => {
  // ── dialog visibility ──────────────────────────────────────────────────────
  describe('dialog visibility', () => {
    it('renders nothing when open=false', () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} open={false} />)
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog when open=true', () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('shows pet name in title', () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} petName="Luna" />)
      expect(screen.getByText(/luna/i)).toBeInTheDocument()
    })
  })

  // ── service loading ────────────────────────────────────────────────────────
  describe('loading surgery services', () => {
    it('shows loading indicator while fetching', () => {
      mockGetSurgeryServices.mockReturnValue(new Promise(() => {}) as any)
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      expect(screen.getByText(/loading surgeries/i)).toBeInTheDocument()
    })

    it('hides loading indicator and shows services after fetch', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(screen.queryByText(/loading surgeries/i)).not.toBeInTheDocument()
      // Spay appears in both the trigger span and the radio item after load
      expect(screen.getAllByText('Spay').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Neuter').length).toBeGreaterThan(0)
    })

    it('does not fetch when dialog is closed', () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} open={false} />)
      expect(mockGetSurgeryServices).not.toHaveBeenCalled()
    })

    it('fetches with the current auth token when dialog opens', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await waitFor(() =>
        expect(mockGetSurgeryServices).toHaveBeenCalledWith('test-token'),
      )
    })

    it('does not fetch when token is absent', async () => {
      mockUseAuthStore.mockImplementation(
        (selector: (s: any) => any) => selector({ token: null, user: null }),
      )
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(mockGetSurgeryServices).not.toHaveBeenCalled()
    })

    it('shows error toast when service fetch throws', async () => {
      mockGetSurgeryServices.mockRejectedValue(new Error('Network error'))
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(toast.error).toHaveBeenCalledWith('Failed to load surgery services')
    })
  })

  // ── surgery type selection ─────────────────────────────────────────────────
  describe('surgery type selection', () => {
    it('auto-selects first surgery type and shows its price', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(screen.getByText(/₱3500/)).toBeInTheDocument()
    })

    it('shows no price when service list is empty', async () => {
      mockGetSurgeryServices.mockResolvedValue({
        status: 'SUCCESS',
        data: { items: [] },
      } as any)
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(screen.queryByText(/₱/)).not.toBeInTheDocument()
    })

    it('updates price when a different surgery type is selected', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      fireEvent.click(screen.getByRole('radio', { name: /neuter/i }))

      await waitFor(() => expect(screen.getByText(/₱2500/)).toBeInTheDocument())
    })
  })

  // ── surgery images ─────────────────────────────────────────────────────────
  describe('surgery images', () => {
    it('renders before / during / after upload slots', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(screen.getByText(/before surgery/i)).toBeInTheDocument()
      expect(screen.getByText(/during surgery/i)).toBeInTheDocument()
      expect(screen.getByText(/after surgery/i)).toBeInTheDocument()
    })

    it('calls uploadImage and shows Uploaded badge after valid image select', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      const file = new File(['img'], 'surgery.jpg', { type: 'image/jpeg' })
      const [firstInput] = document.querySelectorAll('input[type="file"]')

      await act(async () => {
        fireEvent.change(firstInput, { target: { files: [file] } })
      })

      await flush()
      expect(mockUploadImage).toHaveBeenCalledWith(file, 'medical-records')
      expect(screen.getByText(/uploaded/i)).toBeInTheDocument()
    })

    it('shows error toast and does not upload non-image file', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
      const [firstInput] = document.querySelectorAll('input[type="file"]')

      fireEvent.change(firstInput, { target: { files: [file] } })

      expect(toast.error).toHaveBeenCalledWith('Please select an image file')
      expect(mockUploadImage).not.toHaveBeenCalled()
    })

    it('removes uploaded image when X button is clicked', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      const file = new File(['img'], 'before.jpg', { type: 'image/jpeg' })
      const [firstInput] = document.querySelectorAll('input[type="file"]')

      await act(async () => {
        fireEvent.change(firstInput, { target: { files: [file] } })
      })
      await flush()
      expect(screen.getByText(/uploaded/i)).toBeInTheDocument()

      const uploadedBadge = screen.getByText(/uploaded/i)
      const card = uploadedBadge.closest('.relative')
      const removeBtn = card?.querySelector('button')
      if (removeBtn) fireEvent.click(removeBtn)

      await flush()
      expect(screen.queryByText(/uploaded/i)).not.toBeInTheDocument()
    })

    it('includes uploaded image URL in submission payload', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      const file = new File(['img'], 'before.jpg', { type: 'image/jpeg' })
      const [firstInput] = document.querySelectorAll('input[type="file"]')

      await act(async () => {
        fireEvent.change(firstInput, { target: { files: [file] } })
      })
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(mockCreateMedicalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              url: 'https://cdn.example.com/img.jpg',
              description: 'before surgery image',
            }),
          ]),
        }),
        'test-token',
      )
    })
  })

  // ── vet remarks ────────────────────────────────────────────────────────────
  describe('vet remarks', () => {
    it('renders textarea with placeholder', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(screen.getByPlaceholderText(/enter any notes/i)).toBeInTheDocument()
    })

    it('includes vet remarks text in submission payload', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      fireEvent.change(screen.getByPlaceholderText(/enter any notes/i), {
        target: { value: 'Watch for infection' },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(mockCreateMedicalRecord).toHaveBeenCalledWith(
        expect.objectContaining({ vetNotes: 'Watch for infection' }),
        'test-token',
      )
    })
  })

  // ── form submission ────────────────────────────────────────────────────────
  describe('form submission', () => {
    it('Save button is disabled when no surgery type is selected', async () => {
      mockGetSurgeryServices.mockResolvedValue({
        status: 'SUCCESS',
        data: { items: [] },
      } as any)
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()
      expect(screen.getByRole('button', { name: /save surgery record/i })).toBeDisabled()
    })

    it('submits with correct petId, appointmentId, and surgery name in visitSummary', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(mockCreateMedicalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          petId: 'pet-001',
          appointmentId: 'appt-001',
          visitSummary: expect.stringContaining('Spay'),
          sharedWithOwner: false,
        }),
        'test-token',
      )
    })

    it('shows success toast and calls onSaved after successful submit', async () => {
      const onSaved = vi.fn()
      render(<SurgeryMedicalRecordModal {...defaultProps} onSaved={onSaved} />)
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(toast.success).toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalled()
    })

    it('calls onOpenChange(false) after successful submit', async () => {
      const onOpenChange = vi.fn()
      render(<SurgeryMedicalRecordModal {...defaultProps} onOpenChange={onOpenChange} />)
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('shows API error message as toast on failure response', async () => {
      mockCreateMedicalRecord.mockResolvedValue({
        status: 'ERROR',
        message: 'Server error',
      } as any)
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(toast.error).toHaveBeenCalledWith('Server error')
    })

    it('falls back to generic error toast when message is absent', async () => {
      mockCreateMedicalRecord.mockResolvedValue({ status: 'ERROR' } as any)
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(toast.error).toHaveBeenCalledWith('Failed to create medical record')
    })

    it('shows generic error toast when API throws', async () => {
      mockCreateMedicalRecord.mockRejectedValue(new Error('Network'))
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      expect(toast.error).toHaveBeenCalledWith(
        'An error occurred while creating the medical record',
      )
    })

    it('disables Skip button during submission', async () => {
      let resolveCreate!: (v: any) => void
      mockCreateMedicalRecord.mockReturnValue(
        new Promise((r) => (resolveCreate = r)) as any,
      )

      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })

      expect(screen.getByRole('button', { name: /skip/i })).toBeDisabled()
      resolveCreate({ status: 'SUCCESS', data: {} })
    })

    it('resets form to first surgery type after successful save', async () => {
      render(<SurgeryMedicalRecordModal {...defaultProps} />)
      await flush()

      // Select second surgery
      fireEvent.click(screen.getByRole('radio', { name: /neuter/i }))
      await waitFor(() => expect(screen.getByText(/₱2500/)).toBeInTheDocument())

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save surgery record/i }))
      })
      await flush()

      // Form reset — first surgery price re-appears
      expect(screen.getByText(/₱3500/)).toBeInTheDocument()
    })
  })

  // ── skip button ────────────────────────────────────────────────────────────
  describe('Skip button', () => {
    it('calls onOpenChange(false) without submitting', () => {
      const onOpenChange = vi.fn()
      render(<SurgeryMedicalRecordModal {...defaultProps} onOpenChange={onOpenChange} />)

      fireEvent.click(screen.getByRole('button', { name: /skip/i }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(mockCreateMedicalRecord).not.toHaveBeenCalled()
    })
  })

  // ── user type parity ───────────────────────────────────────────────────────
  // This modal has no role-based UI differences — access control is the parent's job.
  describe('user type parity', () => {
    it.each([['vet'], ['clinic-admin'], ['pet-owner']])(
      '%s user sees the same surgery form',
      async (userType) => {
        mockUseAuthStore.mockImplementation(mockAuth(userType))
        render(<SurgeryMedicalRecordModal {...defaultProps} />)
        await flush()
        expect(screen.getByText(/surgery type/i)).toBeInTheDocument()
        expect(screen.getByText(/surgery images/i)).toBeInTheDocument()
        expect(screen.getByText(/vet remarks/i)).toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: /save surgery record/i }),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
      },
    )
  })
})
