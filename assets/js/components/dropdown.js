// Custom Dropdown Animation
document.addEventListener('DOMContentLoaded', function() {
  // Mengambil semua elemen select
  const selects = document.querySelectorAll('select');
  
  selects.forEach(select => {
    // Membuat wrapper untuk custom dropdown
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    
    // Membuat elemen untuk custom dropdown
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    
    // Membuat elemen untuk selected option
    const selectedOption = document.createElement('div');
    selectedOption.className = 'custom-select-trigger';
    selectedOption.textContent = select.options[select.selectedIndex].textContent;
    // Jadikan fokusable via keyboard
    selectedOption.setAttribute('tabindex', '0');
    selectedOption.setAttribute('role', 'button');
    
    // Membuat elemen untuk options
    const optionsList = document.createElement('div');
    optionsList.className = 'custom-options';
    const optionItems = [];
    let currentIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
    
    // Menambahkan options ke custom dropdown
    for (let i = 0; i < select.options.length; i++) {
      const optionItem = document.createElement('span');
      optionItem.className = 'custom-option';
      optionItem.setAttribute('data-value', select.options[i].value);
      optionItem.textContent = select.options[i].textContent;
      optionItem.setAttribute('tabindex', '-1'); // tidak masuk tab order
      
      // Menandai option yang selected
      if (select.options[i].selected) {
        optionItem.classList.add('selection');
      }
      
      // Event listener untuk option
      optionItem.addEventListener('click', function() {
        // Update nilai select asli
        select.value = this.getAttribute('data-value');
        
        // Update text di trigger
        selectedOption.textContent = this.textContent;
        
        // Update class selection
        const siblings = this.parentNode.querySelectorAll('.custom-option');
        siblings.forEach(sibling => {
          sibling.classList.remove('selection');
        });
        this.classList.add('selection');

        // Simpan index saat ini
        currentIndex = i;
        
        // Tutup dropdown
        customSelect.classList.remove('opened');
        
        // Trigger event change pada select asli
        const event = new Event('change');
        select.dispatchEvent(event);
      });
      
      optionsList.appendChild(optionItem);
      optionItems.push(optionItem);
    }
    
    // Menambahkan elemen ke DOM
    customSelect.appendChild(selectedOption);
    customSelect.appendChild(optionsList);
    wrapper.appendChild(customSelect);
    
    // Sembunyikan select asli
    select.style.display = 'none';
    
    // Event listener untuk toggle dropdown
    selectedOption.addEventListener('click', function() {
      // Toggle class opened
      if (customSelect.classList.contains('opened')) {
        customSelect.classList.remove('opened');
      } else {
        // Tutup dropdown lain yang terbuka
        document.querySelectorAll('.custom-select.opened').forEach(select => {
          select.classList.remove('opened');
        });
        
        customSelect.classList.add('opened');
      }
    });

    // Keyboard accessibility
    selectedOption.addEventListener('keydown', function(e) {
      const key = e.key;
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        if (customSelect.classList.contains('opened')) {
          customSelect.classList.remove('opened');
        } else {
          // Tutup dropdown lain
          document.querySelectorAll('.custom-select.opened').forEach(sel => sel.classList.remove('opened'));
          customSelect.classList.add('opened');
        }
        return;
      }

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault();
        if (!customSelect.classList.contains('opened')) {
          customSelect.classList.add('opened');
        }
        const max = optionItems.length - 1;
        if (key === 'ArrowDown') {
          currentIndex = Math.min(max, currentIndex + 1);
        } else {
          currentIndex = Math.max(0, currentIndex - 1);
        }
        // Pilih opsi dan pastikan terlihat
        optionItems[currentIndex].click();
        optionItems[currentIndex].scrollIntoView({ block: 'nearest' });
        return;
      }

      if (key === 'Escape') {
        e.preventDefault();
        customSelect.classList.remove('opened');
      }
    });
  });
  
  // Tutup dropdown saat klik di luar
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) {
      document.querySelectorAll('.custom-select.opened').forEach(select => {
        select.classList.remove('opened');
      });
    }
  });

  // Sinkronisasi UI custom saat form di-reset
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('reset', function() {
      // Tunggu browser reset value dulu
      setTimeout(() => {
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
          const nativeSelect = wrapper.querySelector('select');
          const customSelect = wrapper.querySelector('.custom-select');
          const trigger = customSelect.querySelector('.custom-select-trigger');
          const options = customSelect.querySelectorAll('.custom-option');

          if (!nativeSelect || !trigger) return;

          const selectedText = nativeSelect.options[nativeSelect.selectedIndex]?.textContent || '';
          const selectedValue = nativeSelect.value;

          trigger.textContent = selectedText;
          options.forEach(opt => {
            const isSelected = opt.getAttribute('data-value') === selectedValue;
            opt.classList.toggle('selection', isSelected);
          });

          customSelect.classList.remove('opened');
        });
      }, 0);
    });
  });
});