---
title: Contact
description: "Get in touch with The Little Nest about a post, a printable, a collaboration or a privacy request."
---

Hello! I'm Vallari, the mom behind The Little Nest. I read every message, and I'll reply by email, usually within 2 to 3 days.

Write to me about a post or an activity, a question about one of the printables, a collaboration or brand idea, or a privacy request.

<form id="contact-form" class="contact-form" method="POST" action="/api/contact">
  <p class="contact-form__error" hidden>Please check your email address and write a short message, then try again.</p>
  <label>Your name<input type="text" name="name" autocomplete="name" maxlength="120"></label>
  <label>Your email<input type="email" name="email" autocomplete="email" required maxlength="254"></label>
  <label>What is it about?
    <select name="topic">
      <option>A question about a post</option>
      <option>Printables and orders</option>
      <option>Collaboration or brand</option>
      <option>Privacy request</option>
      <option>Something else</option>
    </select>
  </label>
  <label>Your message<textarea name="message" rows="6" required maxlength="5000"></textarea></label>
  <label class="contact-form__hp" aria-hidden="true">Company<input type="text" name="company" tabindex="-1" autocomplete="off"></label>
  <button type="submit">Send message</button>
</form>

<script>if (/[?&]error=1/.test(location.search)) document.querySelector(".contact-form__error").hidden = false;</script>

Your details are used only to reply to you. See the [privacy policy](/privacy/).
