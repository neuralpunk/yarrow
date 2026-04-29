<script lang="ts">
  import Modal from "../../components/Modal.svelte";
  import { tr } from "../../lib/i18n/index.svelte";
  import { isoDate, SESSION_KITS } from "./clinical";

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (template: string, title: string) => void;
  }

  let { open, onClose, onPick }: Props = $props();

  let t = $derived(tr());
  let today = $derived(isoDate());
</script>

<Modal
  {open}
  {onClose}
  title={t("plugin.clinician.sessionKit.title")}
  width="w-[520px]"
>
  <div class="text-2xs text-t2 mb-4 leading-relaxed">
    {t("plugin.clinician.sessionKit.intro")}
  </div>
  <div class="grid grid-cols-1 gap-2">
    {#each SESSION_KITS as kit (kit.template)}
      <button
        type="button"
        onclick={() => {
          onPick(kit.template, `${kit.titlePrefix} – ${today}`);
          onClose();
        }}
        class="text-left grid grid-cols-[64px_1fr] gap-3 items-center p-3 rounded-md border border-bd bg-s1 hover:border-teal-700 hover:bg-teal-700/5 transition"
      >
        <div class="px-2 py-1.5 rounded-md bg-teal-700 text-bg text-xs font-mono text-center">
          {kit.titlePrefix}
        </div>
        <div class="min-w-0">
          <div class="text-sm text-char">{t(kit.labelKey)}</div>
          <div class="text-2xs text-t2 leading-snug mt-0.5">{t(kit.descKey)}</div>
        </div>
      </button>
    {/each}
  </div>
  <div class="text-2xs text-t3 mt-3 leading-snug">
    {t("plugin.clinician.sessionKit.note")}
  </div>
</Modal>
