<script>
  import Pad from "./Pad.svelte";
  import { padMenu } from "../lib/state";
  export let pads;
</script>

<style>
  .tools-grid {
    padding: 0;
    margin: 0;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr 1fr;
    background: black;
  }
</style>

<div class="tools-grid">
  {#each pads as pad}
    <Pad buttonId={pad.id} active={pad.active} />
  {/each}
</div>
