<script lang="ts">
  import Button from '../../Button.svelte';

  interface Props {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
  }

  let {
    label,
    onClick,
    loading = false,
    disabled = false,
    variant = 'primary',
  }: Props = $props();
</script>

<Button {loading} {disabled} {variant} type="button" ariaLabel={label} onclick={onClick}>
  {label}
</Button>
