<script lang="ts">
import Field from '../../Field.svelte';
import Input from '../../Input.svelte';

  interface Props {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    value?: string;
  }

  let {
    label,
    required = false,
    error = '',
    hint = '',
    value = '',
  }: Props = $props();
</script>

<Field label={label} id="field-1" {required} {error} {hint}>
  <Input id="field-1" name="field-1" value={value} error={Boolean(error)} aria-invalid={Boolean(error)} />
</Field>
