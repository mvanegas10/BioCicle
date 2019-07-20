while IFS='' read -r line || [[ -n "$line" ]]; do
    echo | grep nucl_gb.accession2taxid -e $line $"\r" >> taxids.txt
done < "$1"