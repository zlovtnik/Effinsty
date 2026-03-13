<script lang="ts">
  import Button from '../../Button.svelte';

  interface Props {
    label: string;
    onClick: () => void;
    type?: 'button' | 'submit' | 'reset';
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
  }

  let {
    label,
    onClick,
    type = 'button',
    loading = false,
    disabled = false,
    variant = 'primary',
  }: Props = $props();
</script>

<Button {loading} {disabled} {variant} {type} ariaLabel={label} onclick={onClick}>
  {label}
</Button>
