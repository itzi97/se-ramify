<script lang="ts">
  /**
   * A diagram kind's icon on a wash of its family colour: the same mark in the
   * list, the top strip, the new-diagram cards, the hand-ins and the welcome
   * screen, so a kind is recognised by colour and shape before its name is read.
   */
  import { familyOf, kindInfo } from '../model/kinds';
  import type { DiagramKind } from '../model/types';
  import Icon from './Icon.svelte';

  let { kind, size = 'md', title }: { kind: DiagramKind; size?: 'sm' | 'md' | 'lg'; title?: string } = $props();
  const info = $derived(kindInfo(kind));
  const fam = $derived(familyOf(kind));
  const px = $derived(size === 'sm' ? 13 : size === 'lg' ? 20 : 15);
</script>

<span class="kb {size}" style:--fam={fam.color} title={title ?? `${info.es} · ${fam.label}`} aria-hidden={title ? undefined : 'true'}>
  <Icon name={info.icon} size={px} />
</span>

<style>
  .kb {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    color: var(--fam);
    background: color-mix(in srgb, var(--fam) 14%, var(--panel));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fam) 22%, transparent);
  }
  .kb.sm {
    width: 20px;
    height: 20px;
    border-radius: 6px;
  }
  .kb.lg {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }
</style>
