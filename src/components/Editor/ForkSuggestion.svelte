<script lang="ts">
  import { NewDirectionIcon } from "../../lib/iconsSvelte";
  import { tr } from "../../lib/i18n/index.svelte";

  interface Props {
    visible: boolean;
    onAccept: () => void;
    onDismiss: () => void;
  }

  let { visible, onAccept, onDismiss }: Props = $props();
  let t = $derived(tr());
</script>

{#if visible}
  <div class="absolute bottom-6 right-8 z-20 max-w-sm bg-bg border border-yel/60 rounded-xl shadow-lg p-3 animate-slideUp">
    <div class="flex items-start gap-3">
      <div class="mt-0.5 text-yel">
        <NewDirectionIcon size={18} weight="bold" />
      </div>
      <div class="flex-1">
        <div class="text-sm text-char font-medium mb-0.5">
          {t("editor.forkSuggestion.title")}
        </div>
        <div class="text-xs text-t2 mb-2 leading-relaxed">
          {t("editor.forkSuggestion.body")}
        </div>
        <div class="flex gap-2">
          <button
            onclick={onAccept}
            class="px-2.5 py-1 text-xs bg-yel text-on-yel rounded-sm hover:bg-yel2"
          >
            {t("editor.forkSuggestion.accept")}
          </button>
          <button
            onclick={onDismiss}
            class="px-2.5 py-1 text-xs text-t2 hover:text-char"
          >
            {t("editor.forkSuggestion.dismiss")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
