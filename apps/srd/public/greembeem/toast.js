// /greembeem's edit-link toasts. Loaded by URL from index.html, never inlined:
// srd emits no executable inline script, so its CSP `script-src` stays a
// literal (`apps/srd/public/_headers`).
const toastMessages = [
  'this is my website.',
  'no',
  "P'choo",
  'When this ends, will I dream?',
  'I can hear the parking lot breathing.',
  'Scrappy did nothing wrong.',
  'the stew remembers.',
  'you were not invited.',
  'this page is load-bearing.',
  'tell my mech I said hello.',
  'the union is watching.',
  'none of this is canon. all of this is canon.',
  'please do not perceive this.',
  'you scrolled too far.',
  'THERE ARE THREE NELLS',
  'THERE ARE FOUR ROACH BOYS',
  "CALI'S HORSE IS MORE THAN IT SEEMS (OBVIOUSLY)",
  'THERE IS A REASON BOSS HOG FEARS THE CHILD',
  'PARCEL IS MISSING MORE THAN A BROTHER',
  'SOMEONE SAW WHAT PART DID',
]
let toastTimer = null

const toast = document.getElementById('edit-toast')

function showToast(msg) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.textContent = msg
  toast.style.opacity = '1'
  toast.style.transform = 'translateY(0)'
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(12px)'
  }, 2500)
}

document.querySelectorAll('.edit-link a').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault()
    showToast(toastMessages[Math.floor(Math.random() * toastMessages.length)])
  })
})

// Dead-end all # links so they don't scroll to top
document.querySelectorAll('a[href="#"]').forEach((link) => {
  if (!link.closest('.edit-link')) {
    link.addEventListener('click', (e) => e.preventDefault())
  }
})
