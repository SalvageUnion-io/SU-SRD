import type { Story } from '@ladle/react'
import { Toaster, toast } from './toaster'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'UI/Toaster',
}

export const AllTypes: Story = () => (
  <>
    <Toaster />
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        className="rounded bg-su-green px-4 py-2 text-su-white"
        onClick={() =>
          toast.success('Success', {
            description: 'Operation completed successfully.',
          })
        }
      >
        Success Toast
      </button>
      <button
        type="button"
        className="rounded bg-su-orange px-4 py-2 text-su-white"
        onClick={() =>
          toast.error('Error', {
            description: 'Something went wrong.',
          })
        }
      >
        Error Toast
      </button>
      <button
        type="button"
        className="rounded bg-su-blue px-4 py-2 text-su-white"
        onClick={() =>
          toast.info('Info', {
            description: 'Here is some information.',
          })
        }
      >
        Info Toast
      </button>
      <button
        type="button"
        className="rounded bg-su-black px-4 py-2 text-su-white"
        onClick={() =>
          toast.warning('Warning', {
            description: 'Please be careful.',
          })
        }
      >
        Warning Toast
      </button>
    </div>
  </>
)
