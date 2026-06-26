import App from "./app/App.svelte";
import { mount } from "svelte";
import "./styles.css";

const target = document.getElementById("app");

if (target === null) {
  throw new Error("Office app mount target #app was not found.");
}

const app = mount(App, { target });

export default app;
