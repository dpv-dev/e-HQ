<script lang="ts">
  import { iconPaths, type IconName } from "./icons.js";

  interface Props {
    readonly name: IconName;
    readonly size: number;
    readonly strokeWidth: number;
  }

  const props: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={props.size}
  height={props.size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={props.strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {@html iconPaths[props.name]}
</svg>
