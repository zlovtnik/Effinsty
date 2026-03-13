<script lang="ts">
import Modal from '../../Modal.svelte';

  interface Action {
    label: string;
    tone?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
    disabled?: boolean;
    onClick: () => void;
  }

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialFocus?: string;
  }

  let {
    isOpen,
    onClose,
    initialFocus = 'primary-focus',
  }: Props = $props();

  const actions: Action[] = [
    { label: 'Cancel', tone: 'secondary', onClick: () => onClose() },
    { label: 'Confirm', tone: 'primary', onClick: () => onClose() },
  ];

</script>

<Modal
  {isOpen}
  title="Confirm action"
  description="This operation is irreversible."
  onClose={onClose}
  {initialFocus}
  {actions}
>
  <button id="primary-focus" type="button">Primary action</button>
</Modal>
